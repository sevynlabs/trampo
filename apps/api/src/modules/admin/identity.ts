import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, adminAuthProcedure, requireAdminRole } from '../../trpc';
import { prisma } from '@trampo/db';
import { supabase } from '../../lib/supabase';
import { logAudit } from '../../lib/audit';
import { notify } from '../../integrations/push';

const KYC_BUCKET = 'kyc-documents';
const URL_TTL_SECONDS = 300;

async function sign(path: string | null | undefined): Promise<string | null> {
  if (!path) return null;
  const { data, error } = await supabase.storage.from(KYC_BUCKET).createSignedUrl(path, URL_TTL_SECONDS);
  if (error || !data) {
    console.error('[ADMIN-IDENTITY] Failed to sign URL for', path, error);
    return null;
  }
  return data.signedUrl;
}

/**
 * Review of the minimum (identity) verification that EVERY user sends.
 * Users whose professional verification is also waiting are reviewed in the
 * professional queue instead (approving it approves the identity too), so
 * they are left out of this queue.
 */
export const identityAdminRouter = router({
  listPending: adminAuthProcedure.query(async () => {
    const rows = await prisma.identityVerification.findMany({
      where: { status: 'SUBMITTED', NOT: { user: { taskerProfile: { kycStatus: 'SUBMITTED' } } } },
      orderBy: { submittedAt: 'asc' },
      select: {
        submittedAt: true,
        user: { select: { id: true, name: true, phone: true, email: true, role: true } },
      },
    });
    return rows.map((r) => ({
      userId: r.user.id,
      name: r.user.name,
      phone: r.user.phone,
      email: r.user.email,
      role: r.user.role,
      submittedAt: r.submittedAt?.toISOString() ?? null,
    }));
  }),

  getDetails: adminAuthProcedure.input(z.object({ userId: z.string().uuid() })).query(async ({ input }) => {
    const identity = await prisma.identityVerification.findUnique({
      where: { userId: input.userId },
      include: { user: { select: { id: true, name: true, phone: true, email: true, role: true, createdAt: true } } },
    });
    if (!identity) throw new TRPCError({ code: 'NOT_FOUND', message: 'Verificação não encontrada' });

    const [front, back, selfie] = await Promise.all([
      sign(identity.documentFrontPath),
      sign(identity.documentBackPath),
      sign(identity.selfiePath),
    ]);

    return {
      status: identity.status,
      submittedAt: identity.submittedAt?.toISOString() ?? null,
      rejectReason: identity.rejectReason,
      user: { ...identity.user, createdAt: identity.user.createdAt.toISOString() },
      documents: { front, back, selfie },
    };
  }),

  approve: requireAdminRole('SUPER_ADMIN', 'OPERATOR')
    .input(z.object({ userId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const updated = await prisma.identityVerification.updateMany({
        where: { userId: input.userId, status: 'SUBMITTED' },
        data: { status: 'APPROVED', approvedAt: new Date(), rejectedAt: null, rejectReason: null },
      });
      if (updated.count === 0) {
        throw new TRPCError({ code: 'CONFLICT', message: 'Esta verificação não está aguardando análise' });
      }
      await logAudit({ actorId: ctx.admin.id, action: 'identity.approve', targetType: 'user', targetId: input.userId });
      await notify(input.userId, {
        title: 'Identidade verificada ✅',
        body: 'Seus documentos foram aprovados.',
        data: { type: 'identity_approved' },
      });
      return { success: true };
    }),

  reject: requireAdminRole('SUPER_ADMIN', 'OPERATOR')
    .input(z.object({ userId: z.string().uuid(), reason: z.string().trim().min(3, 'Informe o motivo da reprovação') }))
    .mutation(async ({ ctx, input }) => {
      const updated = await prisma.identityVerification.updateMany({
        where: { userId: input.userId, status: 'SUBMITTED' },
        data: { status: 'REJECTED', rejectedAt: new Date(), rejectReason: input.reason, approvedAt: null },
      });
      if (updated.count === 0) {
        throw new TRPCError({ code: 'CONFLICT', message: 'Esta verificação não está aguardando análise' });
      }
      await logAudit({
        actorId: ctx.admin.id,
        action: 'identity.reject',
        targetType: 'user',
        targetId: input.userId,
        metadata: { reason: input.reason },
      });
      await notify(input.userId, {
        title: 'Documentos reprovados',
        body: `${input.reason}. Envie novamente para continuar publicando e contratando.`,
        data: { type: 'identity_rejected' },
      });
      return { success: true };
    }),
});

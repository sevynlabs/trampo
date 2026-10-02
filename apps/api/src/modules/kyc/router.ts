import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure, adminAuthProcedure } from '../../trpc';
import { prisma } from '@trampo/db';
import { supabase } from '../../lib/supabase';
import { isAdminUser } from '../../lib/admin';

const KYC_BUCKET = 'kyc-documents';

export const kycRouter = router({
  /**
   * Get KYC status
   */
  getStatus: protectedProcedure.query(async ({ ctx }) => {
    const profile = await prisma.taskerProfile.findUnique({
      where: { userId: ctx.user.id },
      select: {
        kycStatus: true,
        kycSubmittedAt: true,
        kycApprovedAt: true,
        kycRejectedAt: true,
        kycRejectReason: true,
        documentFrontPath: true,
        documentBackPath: true,
        selfiePath: true,
      },
    });

    if (!profile) {
      return {
        status: 'PENDING' as const,
        steps: { cpf: true, document: false, selfie: false },
      };
    }

    return {
      status: profile.kycStatus,
      submittedAt: profile.kycSubmittedAt?.toISOString(),
      approvedAt: profile.kycApprovedAt?.toISOString(),
      rejectedAt: profile.kycRejectedAt?.toISOString(),
      rejectReason: profile.kycRejectReason,
      steps: {
        cpf: true,
        document: !!profile.documentFrontPath,
        selfie: !!profile.selfiePath,
      },
    };
  }),

  /**
   * Get signed upload URL for Supabase Storage
   */
  getUploadUrl: protectedProcedure
    .input(
      z.object({
        type: z.enum(['document_front', 'document_back', 'selfie']),
        contentType: z.enum(['image/jpeg', 'image/png']),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { type, contentType } = input;
      const ext = contentType === 'image/jpeg' ? 'jpg' : 'png';
      const path = `${ctx.user.id}/${type}_${Date.now()}.${ext}`;

      // Create signed upload URL (5 min expiry)
      const { data, error } = await supabase.storage
        .from(KYC_BUCKET)
        .createSignedUploadUrl(path);

      if (error || !data) {
        console.error('[KYC] Upload URL error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Falha ao gerar URL de upload',
        });
      }

      return {
        uploadUrl: data.signedUrl,
        token: data.token,
        path,
      };
    }),

  /**
   * Confirm document uploaded and save path
   */
  confirmUpload: protectedProcedure
    .input(
      z.object({
        type: z.enum(['document_front', 'document_back', 'selfie']),
        path: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { type, path } = input;

      // The path must be one we issued to THIS user for THIS document type
      const expected = new RegExp(`^${ctx.user.id}/${type}_[0-9]+[.](jpg|png)$`);
      if (!expected.test(path)) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Caminho de documento inválido' });
      }

      // Documents are frozen while under review or after approval
      const current = await prisma.taskerProfile.findUnique({
        where: { userId: ctx.user.id },
        select: { kycStatus: true },
      });
      if (current && (current.kycStatus === 'SUBMITTED' || current.kycStatus === 'APPROVED')) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Seus documentos já estão em análise ou aprovados',
        });
      }

      const fieldMap = {
        document_front: 'documentFrontPath',
        document_back: 'documentBackPath',
        selfie: 'selfiePath',
      } as const;

      await prisma.taskerProfile.upsert({
        where: { userId: ctx.user.id },
        update: { [fieldMap[type]]: path },
        create: { userId: ctx.user.id, [fieldMap[type]]: path },
      });

      return { success: true };
    }),

  /**
   * Get signed URL to view a document
   * Users can only view their own documents
   * Admins can view any document
   */
  getViewUrl: protectedProcedure
    .input(z.object({ path: z.string() }))
    .query(async ({ ctx, input }) => {
      // SECURITY: Verify ownership - path format is "{userId}/{type}_{timestamp}.{ext}"
      const isOwner = /^[0-9a-f-]{36}\/(document_front|document_back|selfie)_\d+\.(jpg|png)$/.test(input.path) &&
        input.path.startsWith(`${ctx.user.id}/`);
      const isAdmin = isAdminUser(ctx.user.id);

      if (!isOwner && !isAdmin) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Você não tem permissão para visualizar este documento',
        });
      }

      const { data, error } = await supabase.storage
        .from(KYC_BUCKET)
        .createSignedUrl(input.path, 60); // 1 min expiry

      if (error) {
        throw new TRPCError({ code: 'NOT_FOUND' });
      }

      return { url: data.signedUrl };
    }),

  /**
   * Submit KYC for review
   */
  submit: protectedProcedure.mutation(async ({ ctx }) => {
    const profile = await prisma.taskerProfile.findUnique({
      where: { userId: ctx.user.id },
    });

    if (!profile) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Perfil não encontrado' });
    }

    // Re-submitting would pull an approved tasker out of APPROVED mid-task
    if (profile.kycStatus === 'SUBMITTED' || profile.kycStatus === 'APPROVED') {
      return { success: true };
    }

    if (!profile.documentFrontPath || !profile.selfiePath) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Envie todos os documentos obrigatórios',
      });
    }

    await prisma.taskerProfile.update({
      where: { id: profile.id },
      data: { kycStatus: 'SUBMITTED', kycSubmittedAt: new Date() },
    });

    return { success: true };
  }),
});

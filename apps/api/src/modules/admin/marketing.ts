import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, adminAuthProcedure, requireAdminRole } from '../../trpc';
import { prisma } from '@trampo/db';
import { logAudit } from '../../lib/audit';

const KIND = z.enum(['PERCENT', 'FIXED']);

/**
 * Marketing: promotional coupons. Coupons are managed here; application to
 * checkout pricing is a separate concern (pricing domain) — this is the
 * back-office CRUD + activation surface.
 */
export const marketingRouter = router({
  listCoupons: adminAuthProcedure.query(async () => {
    const coupons = await prisma.coupon.findMany({ orderBy: { createdAt: 'desc' } });
    return coupons.map((c) => ({
      id: c.id,
      code: c.code,
      kind: c.kind,
      value: c.value,
      maxUses: c.maxUses,
      usedCount: c.usedCount,
      validFrom: c.validFrom?.toISOString() ?? null,
      validUntil: c.validUntil?.toISOString() ?? null,
      isActive: c.isActive,
    }));
  }),

  createCoupon: requireAdminRole('SUPER_ADMIN', 'OPERATOR')
    .input(
      z.object({
        code: z.string().trim().min(3).max(32).toUpperCase(),
        kind: KIND,
        value: z.number().int().min(1),
        maxUses: z.number().int().min(1).optional(),
        validUntil: z.string().datetime().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (input.kind === 'PERCENT' && input.value > 100)
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Percentual máximo é 100' });

      const existing = await prisma.coupon.findUnique({ where: { code: input.code } });
      if (existing)
        throw new TRPCError({ code: 'CONFLICT', message: 'Código já existe' });

      const c = await prisma.coupon.create({
        data: {
          code: input.code,
          kind: input.kind,
          value: input.value,
          maxUses: input.maxUses ?? null,
          validUntil: input.validUntil ? new Date(input.validUntil) : null,
        },
      });
      await logAudit({
        actorId: ctx.admin.id,
        action: 'coupon.create',
        targetType: 'coupon',
        targetId: c.id,
        metadata: { code: c.code, kind: c.kind, value: c.value },
      });
      return { id: c.id };
    }),

  toggleCoupon: requireAdminRole('SUPER_ADMIN', 'OPERATOR')
    .input(z.object({ id: z.string().uuid(), isActive: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      await prisma.coupon.update({
        where: { id: input.id },
        data: { isActive: input.isActive },
      });
      await logAudit({
        actorId: ctx.admin.id,
        action: 'coupon.toggle',
        targetType: 'coupon',
        targetId: input.id,
        metadata: { isActive: input.isActive },
      });
      return { id: input.id };
    }),

  deleteCoupon: requireAdminRole('SUPER_ADMIN', 'OPERATOR')
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await prisma.coupon.delete({ where: { id: input.id } });
      await logAudit({
        actorId: ctx.admin.id,
        action: 'coupon.delete',
        targetType: 'coupon',
        targetId: input.id,
      });
      return { id: input.id };
    }),
});

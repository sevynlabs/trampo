import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import {
  router,
  adminAuthProcedure,
  requireAdminRole,
} from '../../trpc';
import { prisma, Prisma } from '@trampo/db';
import { logAudit } from '../../lib/audit';

const PAYMENT_STATUS = z.enum([
  'PENDING',
  'CONFIRMED',
  'HELD',
  'RELEASED',
  'REFUNDED',
  'DISPUTED',
  'EXPIRED',
]);

const WITHDRAWAL_STATUS = z.enum(['PENDING', 'PAID', 'FAILED']);

function toNum(v: unknown): number {
  if (typeof v === 'bigint') return Number(v);
  return Number(v ?? 0);
}

/**
 * Financial management: payments ledger, escrow timelines, revenue reporting,
 * and tasker withdrawal payouts. Money-moving actions are gated on role and
 * recorded to the audit log. All values are centavos.
 */
export const financeRouter = router({
  // ---- Payments -----------------------------------------------------------

  /** Paginated, filterable payments ledger. */
  listPayments: adminAuthProcedure
    .input(
      z.object({
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(1).max(100).default(20),
        status: z.union([PAYMENT_STATUS, z.literal('ALL')]).default('ALL'),
        days: z.number().int().min(1).max(365).optional(),
      })
    )
    .query(async ({ input }) => {
      const where: Prisma.PaymentWhereInput = {};
      if (input.status !== 'ALL') where.status = input.status;
      if (input.days) {
        where.createdAt = {
          gte: new Date(Date.now() - input.days * 24 * 60 * 60 * 1000),
        };
      }

      const [total, payments] = await Promise.all([
        prisma.payment.count({ where }),
        prisma.payment.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (input.page - 1) * input.pageSize,
          take: input.pageSize,
          select: {
            id: true,
            amount: true,
            platformFee: true,
            taskerAmount: true,
            status: true,
            createdAt: true,
            paidAt: true,
            task: { select: { id: true, title: true } },
            user: { select: { id: true, name: true } },
          },
        }),
      ]);

      return {
        payments: payments.map((p) => ({
          id: p.id,
          amount: p.amount,
          platformFee: p.platformFee,
          taskerAmount: p.taskerAmount,
          status: p.status,
          createdAt: p.createdAt.toISOString(),
          paidAt: p.paidAt?.toISOString() ?? null,
          taskId: p.task?.id ?? null,
          taskTitle: p.task?.title ?? null,
          payerName: p.user?.name ?? null,
        })),
        total,
        page: input.page,
        pageSize: input.pageSize,
        totalPages: Math.max(1, Math.ceil(total / input.pageSize)),
      };
    }),

  /** Single payment with escrow timeline. */
  getPayment: adminAuthProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input }) => {
      const p = await prisma.payment.findUnique({
        where: { id: input.id },
        include: {
          task: { select: { id: true, title: true, status: true } },
          user: { select: { id: true, name: true, phone: true } },
        },
      });
      if (!p) throw new TRPCError({ code: 'NOT_FOUND', message: 'Pagamento não encontrado' });

      return {
        id: p.id,
        amount: p.amount,
        platformFee: p.platformFee,
        taskerAmount: p.taskerAmount,
        status: p.status,
        asaasId: p.asaasId,
        asaasPaymentId: p.asaasPaymentId,
        asaasTransferId: p.asaasTransferId,
        task: p.task,
        payer: p.user,
        timeline: {
          createdAt: p.createdAt.toISOString(),
          paidAt: p.paidAt?.toISOString() ?? null,
          heldAt: p.heldAt?.toISOString() ?? null,
          releasedAt: p.releasedAt?.toISOString() ?? null,
          refundedAt: p.refundedAt?.toISOString() ?? null,
        },
      };
    }),

  /** Aggregate revenue report over a window (centavos). */
  revenueReport: adminAuthProcedure
    .input(z.object({ days: z.number().int().min(1).max(365).default(30) }))
    .query(async ({ input }) => {
      const since = new Date(Date.now() - input.days * 24 * 60 * 60 * 1000);
      const paidWhere: Prisma.PaymentWhereInput = {
        status: { in: ['CONFIRMED', 'HELD', 'RELEASED'] },
        paidAt: { gte: since },
      };

      const [paid, released, refunded, count] = await Promise.all([
        prisma.payment.aggregate({
          _sum: { amount: true, platformFee: true, taskerAmount: true },
          where: paidWhere,
        }),
        prisma.payment.aggregate({
          _sum: { platformFee: true },
          where: { status: 'RELEASED', releasedAt: { gte: since } },
        }),
        prisma.payment.aggregate({
          _sum: { amount: true },
          where: { status: 'REFUNDED', refundedAt: { gte: since } },
        }),
        prisma.payment.count({ where: paidWhere }),
      ]);

      return {
        days: input.days,
        gmv: toNum(paid._sum.amount),
        platformRevenue: toNum(paid._sum.platformFee),
        taskerPayouts: toNum(paid._sum.taskerAmount),
        releasedRevenue: toNum(released._sum.platformFee),
        refundedAmount: toNum(refunded._sum.amount),
        paidCount: count,
      };
    }),

  // ---- Withdrawals --------------------------------------------------------

  /** Paginated tasker withdrawal requests. */
  listWithdrawals: adminAuthProcedure
    .input(
      z.object({
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(1).max(100).default(20),
        status: z.union([WITHDRAWAL_STATUS, z.literal('ALL')]).default('ALL'),
      })
    )
    .query(async ({ input }) => {
      const where: Prisma.WithdrawalWhereInput = {};
      if (input.status !== 'ALL') where.status = input.status;

      const [total, withdrawals, pendingAgg] = await Promise.all([
        prisma.withdrawal.count({ where }),
        prisma.withdrawal.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (input.page - 1) * input.pageSize,
          take: input.pageSize,
          include: {
            taskerProfile: {
              select: {
                id: true,
                user: { select: { id: true, name: true, phone: true } },
              },
            },
          },
        }),
        prisma.withdrawal.aggregate({
          _sum: { amount: true },
          where: { status: 'PENDING' },
        }),
      ]);

      return {
        withdrawals: withdrawals.map((w) => ({
          id: w.id,
          amount: w.amount,
          pixKey: w.pixKey,
          status: w.status,
          failureReason: w.failureReason,
          createdAt: w.createdAt.toISOString(),
          paidAt: w.paidAt?.toISOString() ?? null,
          taskerName: w.taskerProfile?.user?.name ?? null,
          taskerPhone: w.taskerProfile?.user?.phone ?? null,
        })),
        total,
        page: input.page,
        pageSize: input.pageSize,
        totalPages: Math.max(1, Math.ceil(total / input.pageSize)),
        pendingTotal: toNum(pendingAgg._sum.amount),
      };
    }),

  /** Mark a pending withdrawal as PAID (money sent out). SUPER_ADMIN only. */
  payWithdrawal: requireAdminRole('SUPER_ADMIN')
    .input(
      z.object({
        id: z.string().uuid(),
        asaasTransferId: z.string().trim().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const w = await prisma.withdrawal.findUnique({ where: { id: input.id } });
      if (!w) throw new TRPCError({ code: 'NOT_FOUND', message: 'Saque não encontrado' });
      if (w.status !== 'PENDING')
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Saque já está ${w.status}`,
        });

      const updated = await prisma.withdrawal.update({
        where: { id: input.id },
        data: {
          status: 'PAID',
          paidAt: new Date(),
          asaasTransferId: input.asaasTransferId ?? null,
        },
      });

      await logAudit({
        actorId: ctx.admin.id,
        action: 'withdrawal.pay',
        targetType: 'withdrawal',
        targetId: w.id,
        metadata: { amount: w.amount, asaasTransferId: input.asaasTransferId ?? null },
      });

      return { id: updated.id, status: updated.status };
    }),

  /** Reject a pending withdrawal with a reason. SUPER_ADMIN or OPERATOR. */
  rejectWithdrawal: requireAdminRole('SUPER_ADMIN', 'OPERATOR')
    .input(
      z.object({
        id: z.string().uuid(),
        reason: z.string().trim().min(3, 'Informe o motivo'),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const w = await prisma.withdrawal.findUnique({ where: { id: input.id } });
      if (!w) throw new TRPCError({ code: 'NOT_FOUND', message: 'Saque não encontrado' });
      if (w.status !== 'PENDING')
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Saque já está ${w.status}`,
        });

      const updated = await prisma.withdrawal.update({
        where: { id: input.id },
        data: { status: 'FAILED', failureReason: input.reason },
      });

      await logAudit({
        actorId: ctx.admin.id,
        action: 'withdrawal.reject',
        targetType: 'withdrawal',
        targetId: w.id,
        metadata: { amount: w.amount, reason: input.reason },
      });

      return { id: updated.id, status: updated.status };
    }),
});

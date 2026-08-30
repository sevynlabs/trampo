import { z } from 'zod';
import { router, adminAuthProcedure } from '../../trpc';
import { prisma, Prisma } from '@trampo/db';

/** Payment statuses that represent money actually collected from the client. */
const PAID_STATUSES: Prisma.PaymentWhereInput['status'] = {
  in: ['CONFIRMED', 'HELD', 'RELEASED'],
};

function toNum(v: unknown): number {
  if (typeof v === 'bigint') return Number(v);
  if (typeof v === 'number') return v;
  return Number(v ?? 0);
}

/**
 * Dashboard analytics: headline KPIs plus daily time-series for charts.
 * All monetary values are centavos; the UI formats to BRL.
 */
export const dashboardRouter = router({
  /** Headline KPIs for the dashboard home. */
  overview: adminAuthProcedure.query(async () => {
    const since30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [
      gmvAgg,
      revenueAgg,
      payoutAgg,
      totalUsers,
      newUsers30d,
      totalTaskers,
      activeTasks,
      completedTasks,
      totalNonCancelled,
      openDisputes,
      pendingWithdrawals,
    ] = await Promise.all([
      prisma.payment.aggregate({ _sum: { amount: true }, where: { status: PAID_STATUSES } }),
      prisma.payment.aggregate({ _sum: { platformFee: true }, where: { status: PAID_STATUSES } }),
      prisma.payment.aggregate({ _sum: { taskerAmount: true }, where: { status: 'RELEASED' } }),
      prisma.user.count(),
      prisma.user.count({ where: { createdAt: { gte: since30 } } }),
      prisma.user.count({ where: { role: { in: ['TASKER', 'BOTH'] } } }),
      prisma.task.count({ where: { status: { in: ['ACCEPTED', 'IN_PROGRESS'] } } }),
      prisma.task.count({ where: { status: { in: ['COMPLETED', 'RELEASED'] } } }),
      prisma.task.count({ where: { status: { notIn: ['CANCELLED'] } } }),
      prisma.dispute.count({ where: { status: 'OPEN' } }),
      prisma.withdrawal.count({ where: { status: 'PENDING' } }),
    ]);

    const completionRate =
      totalNonCancelled > 0 ? completedTasks / totalNonCancelled : 0;

    return {
      gmv: toNum(gmvAgg._sum.amount),
      platformRevenue: toNum(revenueAgg._sum.platformFee),
      taskerPayouts: toNum(payoutAgg._sum.taskerAmount),
      totalUsers,
      newUsers30d,
      totalTaskers,
      activeTasks,
      completionRate,
      openDisputes,
      pendingWithdrawals,
    };
  }),

  /** Daily GMV + platform revenue for the last N days (centavos). */
  revenueSeries: adminAuthProcedure
    .input(z.object({ days: z.number().int().min(7).max(90).default(30) }))
    .query(async ({ input }) => {
      const since = new Date(Date.now() - input.days * 24 * 60 * 60 * 1000);
      const rows = await prisma.$queryRaw<
        { day: Date; gmv: bigint | null; revenue: bigint | null }[]
      >`
        SELECT date_trunc('day', paid_at) AS day,
               COALESCE(SUM(amount), 0)       AS gmv,
               COALESCE(SUM(platform_fee), 0) AS revenue
        FROM payments
        WHERE paid_at IS NOT NULL
          AND status IN ('CONFIRMED', 'HELD', 'RELEASED')
          AND paid_at >= ${since}
        GROUP BY 1
        ORDER BY 1 ASC
      `;
      return rows.map((r) => ({
        day: r.day.toISOString().slice(0, 10),
        gmv: toNum(r.gmv),
        revenue: toNum(r.revenue),
      }));
    }),

  /** Daily new-user signups for the last N days. */
  usersSeries: adminAuthProcedure
    .input(z.object({ days: z.number().int().min(7).max(90).default(30) }))
    .query(async ({ input }) => {
      const since = new Date(Date.now() - input.days * 24 * 60 * 60 * 1000);
      const rows = await prisma.$queryRaw<{ day: Date; count: bigint }[]>`
        SELECT date_trunc('day', created_at) AS day, COUNT(*) AS count
        FROM users
        WHERE created_at >= ${since}
        GROUP BY 1
        ORDER BY 1 ASC
      `;
      return rows.map((r) => ({
        day: r.day.toISOString().slice(0, 10),
        count: toNum(r.count),
      }));
    }),

  /** Task counts by status for the funnel chart. */
  taskFunnel: adminAuthProcedure.query(async () => {
    const grouped = await prisma.task.groupBy({
      by: ['status'],
      _count: { _all: true },
    });
    const map = Object.fromEntries(
      grouped.map((g) => [g.status, g._count._all])
    ) as Record<string, number>;
    return {
      open: map.OPEN ?? 0,
      accepted: map.ACCEPTED ?? 0,
      inProgress: map.IN_PROGRESS ?? 0,
      completed: map.COMPLETED ?? 0,
      released: map.RELEASED ?? 0,
      cancelled: map.CANCELLED ?? 0,
      disputed: map.DISPUTED ?? 0,
    };
  }),
});

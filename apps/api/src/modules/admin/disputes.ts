import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, adminAuthProcedure, requireAdminRole } from '../../trpc';
import { prisma, Prisma } from '@trampo/db';
import { parsePublicCode } from '../../lib/public-code';
import { logAudit } from '../../lib/audit';
import { resolveDispute } from '../../lib/disputes';
import { periodSchema, sinceFilter, paginationShape, shortCode, codePrefix, uuidPrefixRange, toNum } from './period';

/** Person shape for admin views; publicCode = in-app ID (raw "TR4F9A2C"; the panel formats it). */
const person = { select: { id: true, name: true, avatarUrl: true, publicCode: true } } as const;
const DISPUTE_STATUS = z.enum(['OPEN', 'RESOLVED_RELEASED', 'RESOLVED_REFUNDED']);

const listSelect = {
  id: true,
  reason: true,
  status: true,
  openedById: true,
  createdAt: true,
  resolvedAt: true,
  task: {
    select: {
      id: true,
      title: true,
      totalValue: true,
      clientId: true,
      category: { select: { id: true, name: true } },
      client: person,
      assignment: { select: { tasker: person } },
      payment: { select: { amount: true } },
    },
  },
} satisfies Prisma.DisputeSelect;

type ListRow = Prisma.DisputeGetPayload<{ select: typeof listSelect }>;

function openedBy(d: { openedById: string; task: { clientId: string; assignment: { tasker: { id: string } } | null } }) {
  if (d.openedById === d.task.clientId) return 'CLIENT' as const;
  if (d.openedById === d.task.assignment?.tasker.id) return 'TASKER' as const;
  return 'UNKNOWN' as const;
}

function serializeListItem(d: ListRow) {
  return {
    id: d.id,
    code: shortCode(d.id),
    task: {
      id: d.task.id,
      code: shortCode(d.task.id),
      title: d.task.title,
      category: d.task.category,
    },
    client: d.task.client,
    tasker: d.task.assignment?.tasker ?? null,
    openedBy: openedBy(d),
    reason: d.reason,
    amount: d.task.payment?.amount ?? d.task.totalValue,
    status: d.status,
    createdAt: d.createdAt.toISOString(),
    resolvedAt: d.resolvedAt?.toISOString() ?? null,
  };
}

/** Dispute mediation ("Disputas"). */
export const disputesAdminRouter = router({
  list: adminAuthProcedure
    .input(
      z.object({
        ...paginationShape,
        status: z.union([z.literal('all'), DISPUTE_STATUS]).default('all'),
        period: periodSchema,
      })
    )
    .query(async ({ input }) => {
      const where: Prisma.DisputeWhereInput = {};
      if (input.status !== 'all') where.status = input.status;
      const created = sinceFilter(input.period);
      if (created) where.createdAt = created;
      if (input.search) {
        const s = input.search;
        const or: Prisma.DisputeWhereInput[] = [
          { reason: { contains: s, mode: 'insensitive' } },
          { task: { title: { contains: s, mode: 'insensitive' } } },
          { task: { client: { name: { contains: s, mode: 'insensitive' } } } },
          { task: { assignment: { tasker: { name: { contains: s, mode: 'insensitive' } } } } },
        ];
        const userCode = parsePublicCode(s);
        if (userCode) {
          or.push({ task: { client: { publicCode: userCode } } }, { task: { assignment: { tasker: { publicCode: userCode } } } });
        }
        const prefix = codePrefix(s);
        if (prefix) {
          or.push({ id: uuidPrefixRange(prefix) }, { taskId: uuidPrefixRange(prefix) });
        }
        where.OR = or;
      }

      const [total, disputes] = await Promise.all([
        prisma.dispute.count({ where }),
        prisma.dispute.findMany({
          where,
          orderBy: [{ createdAt: input.sortDir }, { id: 'asc' }],
          skip: (input.page - 1) * input.pageSize,
          take: input.pageSize,
          select: listSelect,
        }),
      ]);

      return {
        items: disputes.map(serializeListItem),
        total,
        page: input.page,
        pageSize: input.pageSize,
      };
    }),

  get: adminAuthProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input }) => {
      const d = await prisma.dispute.findUnique({
        where: { id: input.id },
        select: {
          ...listSelect,
          resolution: true,
          resolvedById: true,
          task: {
            select: {
              ...listSelect.task.select,
              description: true,
              status: true,
              createdAt: true,
              acceptedAt: true,
              startedAt: true,
              completedAt: true,
              payment: true,
            },
          },
        },
      });
      if (!d) throw new TRPCError({ code: 'NOT_FOUND', message: 'Disputa não encontrada' });

      let resolverName: string | null = null;
      if (d.resolvedById) {
        const admin = await prisma.adminUser.findUnique({ where: { id: d.resolvedById }, select: { name: true } });
        resolverName = admin?.name ?? null;
        if (!resolverName) {
          const user = await prisma.user.findUnique({ where: { id: d.resolvedById }, select: { name: true } });
          resolverName = user?.name ?? null;
        }
      }

      const messages = await prisma.message.findMany({
        where: { taskId: d.task.id },
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: { id: true, content: true, createdAt: true, sender: { select: { id: true, name: true } } },
      });

      const t = d.task;
      const events: { key: string; label: string; at: Date | null }[] = [
        { key: 'taskCreated', label: 'Solicitação criada', at: t.createdAt },
        { key: 'taskAccepted', label: 'Aceita pelo profissional', at: t.acceptedAt },
        { key: 'taskStarted', label: 'Serviço iniciado', at: t.startedAt },
        { key: 'taskCompleted', label: 'Serviço concluído', at: t.completedAt },
        { key: 'disputeOpened', label: 'Disputa aberta', at: d.createdAt },
        {
          key: 'disputeResolved',
          label:
            d.status === 'RESOLVED_RELEASED'
              ? 'Resolvida: pagamento liberado ao profissional'
              : 'Resolvida: valor reembolsado ao cliente',
          at: d.resolvedAt,
        },
      ];
      const timeline = events
        .filter((e): e is { key: string; label: string; at: Date } => e.at instanceof Date)
        .map((e) => ({ key: e.key, label: e.label, at: e.at.toISOString() }))
        .sort((a, b) => a.at.localeCompare(b.at));

      const p = t.payment;
      return {
        ...serializeListItem({ ...d, task: { ...t, payment: p ? { amount: p.amount } : null } }),
        task: {
          id: t.id,
          code: shortCode(t.id),
          title: t.title,
          description: t.description,
          status: t.status,
          totalValue: t.totalValue,
          category: t.category,
        },
        resolution: d.resolution,
        resolvedById: d.resolvedById,
        resolverName,
        timeline,
        payment: p
          ? {
              id: p.id,
              status: p.status,
              amount: p.amount,
              platformFee: p.platformFee,
              taskerAmount: p.taskerAmount,
              paidAt: p.paidAt?.toISOString() ?? null,
              heldAt: p.heldAt?.toISOString() ?? null,
              releasedAt: p.releasedAt?.toISOString() ?? null,
              refundedAt: p.refundedAt?.toISOString() ?? null,
            }
          : null,
        // Oldest first (last 50 messages of the task chat).
        messages: messages.reverse().map((m) => ({
          id: m.id,
          senderId: m.sender.id,
          senderName: m.sender.name,
          senderRole:
            m.sender.id === t.clientId
              ? ('CLIENT' as const)
              : m.sender.id === t.assignment?.tasker.id
                ? ('TASKER' as const)
                : ('OTHER' as const),
          content: m.content,
          createdAt: m.createdAt.toISOString(),
        })),
      };
    }),

  stats: adminAuthProcedure.query(async () => {
    const [grouped, openAmountRows] = await Promise.all([
      prisma.dispute.groupBy({ by: ['status'], _count: { _all: true } }),
      prisma.$queryRaw<{ total: bigint | null }[]>`
        SELECT COALESCE(SUM(COALESCE(p.amount, t.total_value)), 0) AS total
        FROM disputes d
        JOIN tasks t ON t.id = d.task_id
        LEFT JOIN payments p ON p.task_id = t.id
        WHERE d.status = 'OPEN'
      `,
    ]);
    const counts = { OPEN: 0, RESOLVED_RELEASED: 0, RESOLVED_REFUNDED: 0 };
    for (const g of grouped) counts[g.status] = g._count._all;
    return {
      counts,
      total: counts.OPEN + counts.RESOLVED_RELEASED + counts.RESOLVED_REFUNDED,
      openAmount: toNum(openAmountRows[0]?.total),
    };
  }),

  resolve: requireAdminRole('SUPER_ADMIN', 'OPERATOR')
    .input(
      z.object({
        id: z.string().uuid(),
        outcome: z.enum(['RELEASE', 'REFUND']),
        notes: z.string().trim().min(5, 'Descreva a decisão (mín. 5 caracteres)').max(1000),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const d = await prisma.dispute.findUnique({ where: { id: input.id }, select: { id: true, taskId: true } });
      if (!d) throw new TRPCError({ code: 'NOT_FOUND', message: 'Disputa não encontrada' });

      const result = await resolveDispute({
        taskId: d.taskId,
        outcome: input.outcome,
        notes: input.notes,
        resolverId: ctx.admin.id,
      });

      await logAudit({
        actorId: ctx.admin.id,
        action: input.outcome === 'RELEASE' ? 'dispute.resolve_release' : 'dispute.resolve_refund',
        targetType: 'dispute',
        targetId: d.id,
        metadata: { taskId: d.taskId, outcome: input.outcome, notes: input.notes },
      });

      return result;
    }),
});

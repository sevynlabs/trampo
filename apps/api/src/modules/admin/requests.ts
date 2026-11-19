import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, adminAuthProcedure, requireAdminRole } from '../../trpc';
import { prisma, Prisma } from '@trampo/db';
import { logAudit } from '../../lib/audit';
import {
  periodSchema,
  sinceFilter,
  paginationShape,
  shortCode,
  codePrefix,
  uuidPrefixRange,
} from './period';

export const TASK_STATUSES = [
  'OPEN',
  'ACCEPTED',
  'IN_PROGRESS',
  'COMPLETED',
  'RELEASED',
  'CANCELLED',
  'DISPUTED',
] as const;
const taskStatusSchema = z.enum(TASK_STATUSES);

const TIMELINE_LABELS: Record<string, string> = {
  createdAt: 'Solicitação criada',
  acceptedAt: 'Aceita pelo profissional',
  startedAt: 'Serviço iniciado',
  completedAt: 'Serviço concluído',
  releasedAt: 'Pagamento liberado',
  cancelledAt: 'Solicitação cancelada',
  disputedAt: 'Disputa aberta',
};

export function buildTaskTimeline(t: Record<string, unknown>) {
  return Object.keys(TIMELINE_LABELS)
    .filter((k) => t[k] instanceof Date)
    .map((k) => ({ key: k, label: TIMELINE_LABELS[k], at: (t[k] as Date).toISOString() }))
    .sort((a, b) => a.at.localeCompare(b.at));
}

/** First address segment, trimmed to a list-friendly length. */
export function shortAddress(address: string): string {
  const first = address.split(',').slice(0, 2).join(',').trim();
  return first.length > 60 ? `${first.slice(0, 57)}...` : first;
}

const person = { select: { id: true, name: true, avatarUrl: true } } as const;

const listSelect = {
  id: true,
  title: true,
  totalValue: true,
  status: true,
  isUrgent: true,
  scheduledAt: true,
  createdAt: true,
  address: true,
  category: { select: { id: true, name: true } },
  client: person,
  assignment: { select: { tasker: person } },
  dispute: { select: { id: true } },
  payment: { select: { status: true } },
} satisfies Prisma.TaskSelect;

type ListRow = Prisma.TaskGetPayload<{ select: typeof listSelect }>;

function serializeListItem(t: ListRow) {
  return {
    id: t.id,
    code: shortCode(t.id),
    title: t.title,
    category: t.category,
    client: t.client,
    tasker: t.assignment?.tasker ?? null,
    totalValue: t.totalValue,
    status: t.status,
    isUrgent: t.isUrgent,
    scheduledAt: t.scheduledAt?.toISOString() ?? null,
    createdAt: t.createdAt.toISOString(),
    address: shortAddress(t.address),
    hasDispute: !!t.dispute,
    paymentStatus: t.payment?.status ?? null,
  };
}

/** Builds the task search clause (code/id prefix, title, client, tasker). */
export function taskSearchWhere(search: string): Prisma.TaskWhereInput {
  const or: Prisma.TaskWhereInput[] = [
    { title: { contains: search, mode: 'insensitive' } },
    { client: { name: { contains: search, mode: 'insensitive' } } },
    { client: { phone: { contains: search } } },
    { assignment: { tasker: { name: { contains: search, mode: 'insensitive' } } } },
  ];
  const prefix = codePrefix(search);
  if (prefix) or.push({ id: uuidPrefixRange(prefix) });
  return { OR: or };
}

/** "Solicitações": every task posted on the platform. */
export const requestsAdminRouter = router({
  list: adminAuthProcedure
    .input(
      z.object({
        ...paginationShape,
        status: z.union([z.literal('all'), taskStatusSchema]).default('all'),
        categoryId: z.string().uuid().optional(),
        period: periodSchema,
        sortBy: z.enum(['createdAt', 'totalValue', 'scheduledAt']).default('createdAt'),
      })
    )
    .query(async ({ input }) => {
      const where: Prisma.TaskWhereInput = {};
      if (input.search) Object.assign(where, taskSearchWhere(input.search));
      if (input.status !== 'all') where.status = input.status;
      if (input.categoryId) where.categoryId = input.categoryId;
      const created = sinceFilter(input.period);
      if (created) where.createdAt = created;

      const orderBy: Prisma.TaskOrderByWithRelationInput[] = [
        input.sortBy === 'scheduledAt'
          ? { scheduledAt: { sort: input.sortDir, nulls: 'last' } }
          : { [input.sortBy]: input.sortDir },
        { id: 'asc' },
      ];

      const [total, tasks] = await Promise.all([
        prisma.task.count({ where }),
        prisma.task.findMany({
          where,
          orderBy,
          skip: (input.page - 1) * input.pageSize,
          take: input.pageSize,
          select: listSelect,
        }),
      ]);

      return {
        items: tasks.map(serializeListItem),
        total,
        page: input.page,
        pageSize: input.pageSize,
      };
    }),

  get: adminAuthProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input }) => {
      const t = await prisma.task.findUnique({
        where: { id: input.id },
        select: {
          ...listSelect,
          description: true,
          baseValue: true,
          urgencyFee: true,
          serviceFee: true,
          taskerValue: true,
          acceptedAt: true,
          startedAt: true,
          completedAt: true,
          releasedAt: true,
          cancelledAt: true,
          disputedAt: true,
          updatedAt: true,
          client: { select: { id: true, name: true, avatarUrl: true, phone: true } },
          assignment: { select: { createdAt: true, tasker: { select: { id: true, name: true, avatarUrl: true, phone: true } } } },
          payment: true,
          dispute: true,
          reviews: {
            orderBy: { createdAt: 'asc' },
            select: {
              id: true,
              rating: true,
              comment: true,
              tags: true,
              createdAt: true,
              hiddenAt: true,
              reviewer: person,
              reviewerId: true,
            },
          },
        },
      });
      if (!t) throw new TRPCError({ code: 'NOT_FOUND', message: 'Solicitação não encontrada' });

      const cancellation = t.cancelledAt
        ? await prisma.cancellation.findFirst({
            where: { taskId: t.id },
            orderBy: { createdAt: 'desc' },
            select: { reason: true, cancelledById: true, penaltyAmount: true, wasPenalized: true, createdAt: true },
          })
        : null;

      const p = t.payment;
      const d = t.dispute;
      return {
        ...serializeListItem({ ...t, dispute: d ? { id: d.id } : null, payment: p ? { status: p.status } : null }),
        address: t.address,
        description: t.description,
        client: t.client,
        tasker: t.assignment?.tasker ?? null,
        assignedAt: t.assignment?.createdAt.toISOString() ?? null,
        price: {
          baseValue: t.baseValue,
          urgencyFee: t.urgencyFee,
          serviceFee: t.serviceFee,
          totalValue: t.totalValue,
          taskerValue: t.taskerValue,
          platformRevenue: t.totalValue - t.taskerValue,
        },
        timeline: buildTaskTimeline(t),
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
              createdAt: p.createdAt.toISOString(),
            }
          : null,
        dispute: d
          ? {
              id: d.id,
              status: d.status,
              reason: d.reason,
              openedBy:
                d.openedById === t.client.id
                  ? ('CLIENT' as const)
                  : d.openedById === t.assignment?.tasker.id
                    ? ('TASKER' as const)
                    : ('UNKNOWN' as const),
              resolution: d.resolution,
              createdAt: d.createdAt.toISOString(),
              resolvedAt: d.resolvedAt?.toISOString() ?? null,
            }
          : null,
        cancellation: cancellation
          ? {
              reason: cancellation.reason,
              cancelledById: cancellation.cancelledById,
              penaltyAmount: cancellation.penaltyAmount,
              wasPenalized: cancellation.wasPenalized,
              createdAt: cancellation.createdAt.toISOString(),
            }
          : null,
        reviews: t.reviews.map((r) => ({
          id: r.id,
          rating: r.rating,
          comment: r.comment,
          tags: r.tags,
          createdAt: r.createdAt.toISOString(),
          hiddenAt: r.hiddenAt?.toISOString() ?? null,
          reviewer: r.reviewer,
          direction: r.reviewerId === t.client.id ? ('CLIENT_TO_PRO' as const) : ('PRO_TO_CLIENT' as const),
        })),
        updatedAt: t.updatedAt.toISOString(),
      };
    }),

  /** Task counts per status (for donut / tabs). */
  statusCounts: adminAuthProcedure
    .input(z.object({ period: periodSchema }).default({}))
    .query(async ({ input }) => {
      const created = sinceFilter(input.period);
      const grouped = await prisma.task.groupBy({
        by: ['status'],
        where: created ? { createdAt: created } : undefined,
        _count: { _all: true },
      });
      const counts = Object.fromEntries(TASK_STATUSES.map((s) => [s, 0])) as Record<
        (typeof TASK_STATUSES)[number],
        number
      >;
      for (const g of grouped) counts[g.status] = g._count._all;
      const total = Object.values(counts).reduce((a, b) => a + b, 0);
      return { counts, total };
    }),

  /** Admin cancellation of a task that hasn't started yet (OPEN/ACCEPTED). */
  cancel: requireAdminRole('SUPER_ADMIN', 'OPERATOR')
    .input(z.object({ id: z.string().uuid(), reason: z.string().trim().min(3, 'Informe o motivo').max(500) }))
    .mutation(async ({ ctx, input }) => {
      const task = await prisma.task.findUnique({
        where: { id: input.id },
        select: { id: true, status: true, title: true, payment: { select: { status: true } } },
      });
      if (!task) throw new TRPCError({ code: 'NOT_FOUND', message: 'Solicitação não encontrada' });
      if (task.status !== 'OPEN' && task.status !== 'ACCEPTED') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Só é possível cancelar solicitações abertas ou aceitas',
        });
      }
      if (task.payment && (task.payment.status === 'CONFIRMED' || task.payment.status === 'HELD')) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Há pagamento retido; resolva via disputa',
        });
      }

      await prisma.$transaction(async (tx) => {
        const moved = await tx.task.updateMany({
          where: { id: input.id, status: { in: ['OPEN', 'ACCEPTED'] } },
          data: { status: 'CANCELLED', cancelledAt: new Date() },
        });
        if (moved.count === 0) {
          throw new TRPCError({ code: 'CONFLICT', message: 'O status da solicitação mudou' });
        }
        await tx.cancellation.create({
          data: { taskId: input.id, cancelledById: ctx.admin.id, reason: `[admin] ${input.reason}` },
        });
      });

      await logAudit({
        actorId: ctx.admin.id,
        action: 'task.cancel',
        targetType: 'task',
        targetId: input.id,
        metadata: { reason: input.reason, previousStatus: task.status, title: task.title },
      });

      return { success: true, status: 'CANCELLED' as const };
    }),
});

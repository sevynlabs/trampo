import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, adminAuthProcedure, requireAdminRole } from '../../trpc';
import { prisma, Prisma } from '@trampo/db';
import { logAudit } from '../../lib/audit';
import { periodSchema, sinceFilter, paginationShape, shortCode, codePrefix, uuidPrefixRange } from './period';

const person = { select: { id: true, name: true, avatarUrl: true } } as const;

/**
 * Recompute a professional's rating the same way reviews.submit does
 * (average of reviews received while acting as tasker), now ignoring hidden
 * reviews. No-op when the user has no tasker profile.
 */
export async function recomputeTaskerRating(userId: string): Promise<void> {
  const avg = await prisma.review.aggregate({
    where: { revieweeId: userId, hiddenAt: null, task: { assignment: { taskerId: userId } } },
    _avg: { rating: true },
  });
  await prisma.taskerProfile.updateMany({
    where: { userId },
    data: { rating: avg._avg.rating ?? 0 },
  });
}

/** Review moderation ("Avaliações"). */
export const reviewsAdminRouter = router({
  stats: adminAuthProcedure
    .input(z.object({ period: periodSchema }).default({}))
    .query(async ({ input }) => {
      const created = sinceFilter(input.period);
      const base: Prisma.ReviewWhereInput = created ? { createdAt: created } : {};

      const [avg, grouped, hidden] = await Promise.all([
        prisma.review.aggregate({ where: { ...base, hiddenAt: null }, _avg: { rating: true } }),
        prisma.review.groupBy({ by: ['rating'], where: base, _count: { _all: true } }),
        prisma.review.count({ where: { ...base, hiddenAt: { not: null } } }),
      ]);

      const byRating: Record<1 | 2 | 3 | 4 | 5, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
      for (const g of grouped) {
        if (g.rating >= 1 && g.rating <= 5) byRating[g.rating as 1 | 2 | 3 | 4 | 5] = g._count._all;
      }
      const total = Object.values(byRating).reduce((a, b) => a + b, 0);

      return {
        averageRating: avg._avg.rating ?? 0, // visible reviews only
        total, // includes hidden
        positive: byRating[4] + byRating[5],
        neutral: byRating[3],
        negative: byRating[1] + byRating[2],
        hidden,
        byRating,
      };
    }),

  list: adminAuthProcedure
    .input(
      z.object({
        ...paginationShape,
        rating: z.union([z.literal('all'), z.number().int().min(1).max(5)]).default('all'),
        period: periodSchema,
        visibility: z.enum(['all', 'visible', 'hidden']).default('all'),
        sortBy: z.enum(['createdAt', 'rating']).default('createdAt'),
      })
    )
    .query(async ({ input }) => {
      const where: Prisma.ReviewWhereInput = {};
      if (input.rating !== 'all') where.rating = input.rating;
      const created = sinceFilter(input.period);
      if (created) where.createdAt = created;
      if (input.visibility === 'visible') where.hiddenAt = null;
      if (input.visibility === 'hidden') where.hiddenAt = { not: null };
      if (input.search) {
        const s = input.search;
        const or: Prisma.ReviewWhereInput[] = [
          { comment: { contains: s, mode: 'insensitive' } },
          { reviewer: { name: { contains: s, mode: 'insensitive' } } },
          { reviewee: { name: { contains: s, mode: 'insensitive' } } },
          { task: { title: { contains: s, mode: 'insensitive' } } },
        ];
        const prefix = codePrefix(s);
        if (prefix) or.push({ taskId: uuidPrefixRange(prefix) });
        where.OR = or;
      }

      const [total, reviews] = await Promise.all([
        prisma.review.count({ where }),
        prisma.review.findMany({
          where,
          orderBy: [{ [input.sortBy]: input.sortDir }, { id: 'asc' }],
          skip: (input.page - 1) * input.pageSize,
          take: input.pageSize,
          select: {
            id: true,
            rating: true,
            comment: true,
            tags: true,
            createdAt: true,
            hiddenAt: true,
            hiddenReason: true,
            reviewerId: true,
            reviewer: person,
            reviewee: person,
            task: { select: { id: true, title: true, clientId: true, category: { select: { name: true } } } },
          },
        }),
      ]);

      return {
        items: reviews.map((r) => ({
          id: r.id,
          rating: r.rating,
          comment: r.comment,
          tags: r.tags,
          createdAt: r.createdAt.toISOString(),
          hiddenAt: r.hiddenAt?.toISOString() ?? null,
          hiddenReason: r.hiddenReason,
          task: {
            id: r.task.id,
            code: shortCode(r.task.id),
            title: r.task.title,
            categoryName: r.task.category.name,
          },
          reviewer: r.reviewer,
          reviewee: r.reviewee,
          direction:
            r.reviewerId === r.task.clientId ? ('CLIENT_TO_PRO' as const) : ('PRO_TO_CLIENT' as const),
        })),
        total,
        page: input.page,
        pageSize: input.pageSize,
      };
    }),

  hide: requireAdminRole('SUPER_ADMIN', 'OPERATOR')
    .input(z.object({ id: z.string().uuid(), reason: z.string().trim().min(3, 'Informe o motivo').max(500) }))
    .mutation(async ({ ctx, input }) => {
      const r = await prisma.review.findUnique({ where: { id: input.id }, select: { id: true, revieweeId: true, rating: true } });
      if (!r) throw new TRPCError({ code: 'NOT_FOUND', message: 'Avaliação não encontrada' });

      const updated = await prisma.review.update({
        where: { id: input.id },
        data: { hiddenAt: new Date(), hiddenReason: input.reason },
        select: { hiddenAt: true },
      });
      await recomputeTaskerRating(r.revieweeId);
      await logAudit({
        actorId: ctx.admin.id,
        action: 'review.hide',
        targetType: 'review',
        targetId: r.id,
        metadata: { reason: input.reason, rating: r.rating, revieweeId: r.revieweeId },
      });
      return { id: r.id, hiddenAt: updated.hiddenAt?.toISOString() ?? null };
    }),

  unhide: requireAdminRole('SUPER_ADMIN', 'OPERATOR')
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const r = await prisma.review.findUnique({ where: { id: input.id }, select: { id: true, revieweeId: true, hiddenReason: true } });
      if (!r) throw new TRPCError({ code: 'NOT_FOUND', message: 'Avaliação não encontrada' });

      await prisma.review.update({
        where: { id: input.id },
        data: { hiddenAt: null, hiddenReason: null },
      });
      await recomputeTaskerRating(r.revieweeId);
      await logAudit({
        actorId: ctx.admin.id,
        action: 'review.unhide',
        targetType: 'review',
        targetId: r.id,
        metadata: { previousReason: r.hiddenReason, revieweeId: r.revieweeId },
      });
      return { id: r.id, hiddenAt: null };
    }),
});

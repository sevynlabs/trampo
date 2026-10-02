import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure } from '../../trpc';
import { submitReviewInput } from '@trampo/contracts';
import { prisma } from '@trampo/db';
import { notify, notifications, withTask } from '../../integrations/push';

export const reviewsRouter = router({
  /**
   * Submit a review
   * Only allowed for completed tasks where user was participant
   */
  submit: protectedProcedure
    .input(submitReviewInput)
    .mutation(async ({ ctx, input }) => {
      const { taskId, rating, comment, tags } = input;

      // Get task with participants
      const task = await prisma.task.findUnique({
        where: { id: taskId },
        include: { assignment: true },
      });

      if (!task) {
        throw new TRPCError({ code: 'NOT_FOUND' });
      }

      // Must be completed or released
      if (!['COMPLETED', 'RELEASED'].includes(task.status)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Só é possível avaliar trampos concluídos',
        });
      }

      // Determine reviewer and reviewee
      const isClient = task.clientId === ctx.user.id;
      const isTasker = task.assignment?.taskerId === ctx.user.id;

      if (!isClient && !isTasker) {
        throw new TRPCError({ code: 'FORBIDDEN' });
      }

      const revieweeId = isClient ? task.assignment!.taskerId : task.clientId;
      if (revieweeId === ctx.user.id) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Você não pode se autoavaliar' });
      }

      // Check for existing review
      const existing = await prisma.review.findUnique({
        where: {
          taskId_reviewerId: {
            taskId,
            reviewerId: ctx.user.id,
          },
        },
      });

      if (existing) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Você já avaliou este trampo',
        });
      }

      // Create review
      const review = await prisma.review.create({
        data: {
          taskId,
          reviewerId: ctx.user.id,
          revieweeId,
          rating,
          comment,
          tags: tags ?? [],
        },
      });

      // Send push notification to reviewee
      notify(
        revieweeId,
        withTask(notifications.newReview(rating, ctx.user.name ?? 'Alguém'), taskId)
      ).catch((err) => console.error('[REVIEWS] Push notification failed:', err));

      // Client reviewing the tasker: refresh the tasker's rating, counting only
      // reviews received while acting as tasker. (totalTasks is incremented on
      // escrow release, not here.)
      if (isClient) {
        const avgRating = await prisma.review.aggregate({
          where: { revieweeId, task: { assignment: { taskerId: revieweeId } } },
          _avg: { rating: true },
        });

        await prisma.taskerProfile.updateMany({
          where: { userId: revieweeId },
          data: { rating: avgRating._avg.rating ?? 0 },
        });
      }

      return review;
    }),

  /**
   * List reviews for a user
   */
  listForUser: protectedProcedure
    .input(
      z.object({
        userId: z.string().uuid(),
        limit: z.number().int().min(1).max(50).default(20),
        offset: z.number().int().min(0).default(0),
      })
    )
    .query(async ({ input }) => {
      const { userId, limit, offset } = input;

      const [reviews, total] = await Promise.all([
        prisma.review.findMany({
          where: { revieweeId: userId },
          include: {
            reviewer: {
              select: { id: true, name: true, avatarUrl: true },
            },
            task: {
              select: { title: true, category: { select: { name: true } } },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: limit,
          skip: offset,
        }),
        prisma.review.count({ where: { revieweeId: userId } }),
      ]);

      return { reviews, total };
    }),
});

import { z } from 'zod';
import { router, protectedProcedure } from '../../trpc';
import { prisma } from '@trampo/db';

export const notificationsRouter = router({
  /**
   * List the user's notifications, newest first (cursor-paginated).
   */
  list: protectedProcedure
    .input(
      z
        .object({
          limit: z.number().min(1).max(50).default(30),
          cursor: z.string().uuid().optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const limit = input?.limit ?? 30;
      const items = await prisma.notification.findMany({
        where: { userId: ctx.user.id },
        orderBy: { createdAt: 'desc' },
        take: limit + 1,
        ...(input?.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
      });

      let nextCursor: string | undefined;
      if (items.length > limit) {
        nextCursor = items.pop()!.id;
      }

      return {
        items: items.map((n) => ({
          id: n.id,
          type: n.type,
          title: n.title,
          body: n.body,
          data: n.data,
          read: !!n.readAt,
          createdAt: n.createdAt.toISOString(),
        })),
        nextCursor,
      };
    }),

  /**
   * Count of unread notifications (for the bell badge).
   */
  unreadCount: protectedProcedure.query(async ({ ctx }) => {
    return prisma.notification.count({
      where: { userId: ctx.user.id, readAt: null },
    });
  }),

  markAllRead: protectedProcedure.mutation(async ({ ctx }) => {
    await prisma.notification.updateMany({
      where: { userId: ctx.user.id, readAt: null },
      data: { readAt: new Date() },
    });
    return { success: true };
  }),

  markRead: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await prisma.notification.updateMany({
        where: { id: input.id, userId: ctx.user.id },
        data: { readAt: new Date() },
      });
      return { success: true };
    }),
});

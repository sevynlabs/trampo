import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure } from '../../trpc';
import { prisma } from '@trampo/db';
import { broadcastChatMessage } from '../../lib/supabase';

export const chatRouter = router({
  /**
   * Send a message in task chat
   */
  send: protectedProcedure
    .input(
      z.object({
        taskId: z.string().uuid(),
        content: z.string().min(1).max(1000),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { taskId, content } = input;

      // Verify user has access to this task
      const task = await prisma.task.findUnique({
        where: { id: taskId },
        include: { assignment: true },
      });

      if (!task) {
        throw new TRPCError({ code: 'NOT_FOUND' });
      }

      const isClient = task.clientId === ctx.user.id;
      const isTasker = task.assignment?.taskerId === ctx.user.id;

      if (!isClient && !isTasker) {
        throw new TRPCError({ code: 'FORBIDDEN' });
      }

      // Only allow chat after task is accepted
      if (task.status === 'OPEN') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Chat disponível após aceite do trampo',
        });
      }

      // Create message
      const message = await prisma.message.create({
        data: {
          taskId,
          senderId: ctx.user.id,
          content,
        },
        include: {
          sender: {
            select: { id: true, name: true, avatarUrl: true },
          },
        },
      });

      // Broadcast via Supabase Realtime
      await broadcastChatMessage(taskId, {
        id: message.id,
        senderId: message.senderId,
        senderName: message.sender.name,
        senderAvatar: message.sender.avatarUrl,
        content: message.content,
        createdAt: message.createdAt.toISOString(),
      });

      // TODO: Send push notification to other party

      return message;
    }),

  /**
   * List messages for a task
   */
  listByTask: protectedProcedure
    .input(
      z.object({
        taskId: z.string().uuid(),
        limit: z.number().int().min(1).max(100).default(50),
        cursor: z.string().uuid().optional(), // Last message ID
      })
    )
    .query(async ({ ctx, input }) => {
      const { taskId, limit, cursor } = input;

      // Verify access
      const task = await prisma.task.findUnique({
        where: { id: taskId },
        include: { assignment: true },
      });

      if (!task) {
        throw new TRPCError({ code: 'NOT_FOUND' });
      }

      const isClient = task.clientId === ctx.user.id;
      const isTasker = task.assignment?.taskerId === ctx.user.id;

      if (!isClient && !isTasker) {
        throw new TRPCError({ code: 'FORBIDDEN' });
      }

      // Fetch messages
      const messages = await prisma.message.findMany({
        where: {
          taskId,
          ...(cursor && {
            createdAt: {
              lt: (
                await prisma.message.findUnique({
                  where: { id: cursor },
                  select: { createdAt: true },
                })
              )?.createdAt,
            },
          }),
        },
        include: {
          sender: {
            select: { id: true, name: true, avatarUrl: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit + 1,
      });

      const hasMore = messages.length > limit;
      const items = hasMore ? messages.slice(0, -1) : messages;

      return {
        items: items.reverse(), // Return in chronological order
        nextCursor: hasMore ? items[items.length - 1]?.id : undefined,
      };
    }),
});

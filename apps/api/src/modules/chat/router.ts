import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure } from '../../trpc';
import { prisma } from '@trampo/db';
import { broadcastChatMessage } from '../../lib/supabase';
import { notify, notifications, withTask } from '../../integrations/push';

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

      // Notify listeners via Supabase Realtime. The public channel only gets a
      // content-free "new message" ping; clients then fetch through the
      // authorized listByTask. A broadcast failure must not fail the send
      // (the message is already saved and the client would retry -> duplicate).
      broadcastChatMessage(taskId, { id: message.id }).catch((err) =>
        console.error('[CHAT] Realtime broadcast failed:', err)
      );

      // Send push notification to other party
      const recipientId = isClient ? task.assignment!.taskerId : task.clientId;
      notify(
        recipientId,
        withTask(notifications.newMessage(message.sender.name ?? 'Alguém', task.title), taskId)
      ).catch((err) => console.error('[CHAT] Push notification failed:', err));

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
      // Cursor = oldest message on this page (read BEFORE reversing)
      const nextCursor = hasMore ? items[items.length - 1]?.id : undefined;

      return {
        items: [...items].reverse(), // Return in chronological order
        nextCursor,
      };
    }),
});

import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure, adminProcedure } from '../../trpc';
import { prisma, Prisma } from '@trampo/db';
import { assertTransition } from '../../domain/state-machine';
import { env } from '../../lib/env';
import { isAdminUser } from '../../lib/admin';
import { sendPushNotification, notifications } from '../../integrations/push';

export const disputesRouter = router({
  /**
   * Open a dispute on a task (client or tasker).
   * Valid while the task is IN_PROGRESS or COMPLETED. Opening a dispute
   * freezes the payment (status -> DISPUTED) so the scheduled escrow
   * release job skips it until an admin resolves the case.
   */
  open: protectedProcedure
    .input(
      z.object({
        taskId: z.string().uuid(),
        reason: z.string().min(10).max(1000),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const task = await prisma.task.findUnique({
        where: { id: input.taskId },
        include: { assignment: true, payment: true, dispute: true },
      });

      if (!task) {
        throw new TRPCError({ code: 'NOT_FOUND' });
      }

      const isClient = task.clientId === ctx.user.id;
      const isTasker = task.assignment?.taskerId === ctx.user.id;

      if (!isClient && !isTasker) {
        throw new TRPCError({ code: 'FORBIDDEN' });
      }

      if (task.dispute) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'Já existe uma disputa aberta para este trampo',
        });
      }

      // Only IN_PROGRESS or COMPLETED tasks can be disputed
      assertTransition(task.status, 'DISPUTED');

      await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        await tx.dispute.create({
          data: {
            taskId: input.taskId,
            openedById: ctx.user.id,
            reason: input.reason,
          },
        });

        await tx.task.update({
          where: { id: input.taskId },
          data: { status: 'DISPUTED', disputedAt: new Date() },
        });

        // Freeze the payment so the escrow-release job won't auto-release it
        if (task.payment && (task.payment.status === 'CONFIRMED' || task.payment.status === 'HELD')) {
          await tx.payment.update({
            where: { id: task.payment.id },
            data: { status: 'DISPUTED' },
          });
        }
      });

      // Notify the other party
      const otherPartyId = isClient ? task.assignment?.taskerId : task.clientId;
      if (otherPartyId) {
        sendPushNotification(
          otherPartyId,
          notifications.disputeOpened(task.title)
        ).catch((err) => console.error('[DISPUTES] Push notification failed:', err));
      }

      console.log(`[DISPUTES] Dispute opened on task ${input.taskId} by ${ctx.user.id}`);

      return { success: true };
    }),

  /**
   * Get the dispute for a task (parties involved or admin).
   */
  getByTask: protectedProcedure
    .input(z.object({ taskId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const task = await prisma.task.findUnique({
        where: { id: input.taskId },
        include: { assignment: true, dispute: true },
      });

      if (!task || !task.dispute) {
        throw new TRPCError({ code: 'NOT_FOUND' });
      }

      const isParty =
        task.clientId === ctx.user.id || task.assignment?.taskerId === ctx.user.id;

      if (!isParty && !isAdminUser(ctx.user.id)) {
        throw new TRPCError({ code: 'FORBIDDEN' });
      }

      return task.dispute;
    }),

  /**
   * List all open disputes (admin backoffice).
   */
  listOpen: adminProcedure.query(async () => {
    return prisma.dispute.findMany({
      where: { status: 'OPEN' },
      orderBy: { createdAt: 'asc' },
      include: {
        task: {
          include: {
            client: { select: { id: true, name: true, phone: true } },
            assignment: { include: { tasker: { select: { id: true, name: true, phone: true } } } },
            payment: true,
          },
        },
      },
    });
  }),

  /**
   * Resolve a dispute (admin only).
   * RELEASE -> pay the tasker (escrow released). REFUND -> refund the client.
   */
  resolve: adminProcedure
    .input(
      z.object({
        taskId: z.string().uuid(),
        outcome: z.enum(['RELEASE', 'REFUND']),
        notes: z.string().max(1000).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const task = await prisma.task.findUnique({
        where: { id: input.taskId },
        include: {
          dispute: true,
          payment: true,
          client: { select: { id: true } },
          assignment: { include: { tasker: { include: { taskerProfile: true } } } },
        },
      });

      if (!task || !task.dispute) {
        throw new TRPCError({ code: 'NOT_FOUND' });
      }

      if (task.dispute.status !== 'OPEN') {
        throw new TRPCError({ code: 'CONFLICT', message: 'Disputa já resolvida' });
      }

      const taskerId = task.assignment?.taskerId;
      const isProd = env.NODE_ENV === 'production';

      if (input.outcome === 'RELEASE') {
        // Release escrow to the tasker. The transfer must succeed BEFORE we mark
        // the payment as released — if it throws, the dispute stays OPEN so an
        // admin can retry, instead of recording money that never moved.
        if (isProd && task.payment) {
          const walletId = task.assignment?.tasker.taskerProfile?.asaasWalletId;
          if (!walletId) {
            throw new TRPCError({
              code: 'PRECONDITION_FAILED',
              message: 'Profissional sem carteira Asaas configurada',
            });
          }
          const { transferToTasker } = await import('../../integrations/asaas');
          await transferToTasker({
            walletId,
            amount: task.payment.taskerAmount,
            description: `TRAMPO (disputa): ${task.title}`,
            externalReference: task.payment.id,
          });
        }

        await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
          if (task.payment) {
            await tx.payment.update({
              where: { id: task.payment.id },
              data: { status: 'RELEASED', releasedAt: new Date() },
            });
          }
          await tx.task.update({
            where: { id: input.taskId },
            data: { status: 'RELEASED', releasedAt: new Date() },
          });
          await tx.dispute.update({
            where: { taskId: input.taskId },
            data: {
              status: 'RESOLVED_RELEASED',
              resolution: input.notes,
              resolvedById: ctx.user.id,
              resolvedAt: new Date(),
            },
          });
        });
      } else {
        // Refund the client. Same rule: the refund must succeed before we mark
        // the payment as refunded, otherwise we'd record a refund that never happened.
        if (isProd && task.payment?.asaasPaymentId) {
          const { refundPayment } = await import('../../integrations/asaas');
          await refundPayment({
            chargeId: task.payment.asaasPaymentId,
            description: `Reembolso por disputa: ${task.title}`,
          });
        }

        await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
          if (task.payment) {
            await tx.payment.update({
              where: { id: task.payment.id },
              data: { status: 'REFUNDED', refundedAt: new Date() },
            });
          }
          await tx.task.update({
            where: { id: input.taskId },
            data: { status: 'CANCELLED', cancelledAt: new Date() },
          });
          await tx.dispute.update({
            where: { taskId: input.taskId },
            data: {
              status: 'RESOLVED_REFUNDED',
              resolution: input.notes,
              resolvedById: ctx.user.id,
              resolvedAt: new Date(),
            },
          });
        });
      }

      // Notify both parties
      const outcome = input.outcome === 'RELEASE' ? 'released' : 'refunded';
      for (const userId of [task.client.id, taskerId]) {
        if (userId) {
          sendPushNotification(
            userId,
            notifications.disputeResolved(task.title, outcome)
          ).catch((err) => console.error('[DISPUTES] Push notification failed:', err));
        }
      }

      console.log(`[DISPUTES] Dispute on task ${input.taskId} resolved: ${input.outcome}`);

      return { success: true, outcome: input.outcome };
    }),
});

import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { assertNotInMaintenance } from '../../lib/platform-settings';
import { router, taskerProcedure, protectedProcedure } from '../../trpc';
import { prisma, Prisma } from '@trampo/db';
import { assertTransition, canCancel } from '../../domain/state-machine';
import { calculateCancellationPenalty } from '../../domain/pricing';
import { scheduleEscrowRelease } from '../webhooks';
import { env } from '../../lib/env';
import { notify, notifications, withTask } from '../../integrations/push';

export const matchingRouter = router({
  /**
   * Accept a task
   * Uses optimistic locking to prevent double-accept
   */
  accept: taskerProcedure
    .input(z.object({ taskId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await assertNotInMaintenance();

      const { taskId } = input;

      const target = await prisma.task.findUnique({
        where: { id: taskId },
        select: { clientId: true },
      });
      if (!target) {
        throw new TRPCError({ code: 'NOT_FOUND' });
      }
      if (target.clientId === ctx.user.id) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Você não pode aceitar o seu próprio trampo',
        });
      }

      // Use transaction with conditional update (optimistic lock)
      const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        // Try to update status from OPEN to ACCEPTED
        // Only succeeds if status is still OPEN
        const updated = await tx.task.updateMany({
          where: {
            id: taskId,
            status: 'OPEN',
          },
          data: {
            status: 'ACCEPTED',
            acceptedAt: new Date(),
          },
        });

        if (updated.count === 0) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: 'Trampo já foi aceito por outro profissional',
          });
        }

        // Create assignment
        await tx.taskAssignment.create({
          data: {
            taskId,
            taskerId: ctx.user.id,
          },
        });

        // Return updated task
        return tx.task.findUnique({
          where: { id: taskId },
          include: {
            client: { select: { id: true, name: true, phone: true } },
            category: true,
          },
        });
      });

      // After transaction: notify client to pay
      // The payment charge will be created when client initiates payment
      console.log(`[MATCHING] Task ${taskId} accepted by tasker ${ctx.user.id}`);

      // Send push notification to client
      if (result) {
        notify(
          result.client.id,
          withTask(notifications.taskAccepted(result.title, ctx.user.name ?? 'Um profissional'), taskId)
        ).catch((err) => console.error('[MATCHING] Push notification failed:', err));
      }

      return result;
    }),

  /**
   * Start working on task
   * Requires payment to be confirmed
   */
  start: taskerProcedure
    .input(z.object({ taskId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const task = await prisma.task.findUnique({
        where: { id: input.taskId },
        include: { assignment: true, payment: true },
      });

      if (!task) {
        throw new TRPCError({ code: 'NOT_FOUND' });
      }

      if (task.assignment?.taskerId !== ctx.user.id) {
        throw new TRPCError({ code: 'FORBIDDEN' });
      }

      // Validate state transition
      assertTransition(task.status, 'IN_PROGRESS');

      // Check payment is confirmed (money is secured) and matches the price
      // the tasker accepted
      if (!task.payment || task.payment.status !== 'CONFIRMED') {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'Aguardando confirmação do pagamento',
        });
      }
      if (task.payment.amount !== task.totalValue) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'O valor pago não confere com o valor do trampo',
        });
      }

      // Guarded transition: a concurrent cancel/dispute wins
      const started = await prisma.task.updateMany({
        where: { id: input.taskId, status: 'ACCEPTED' },
        data: {
          status: 'IN_PROGRESS',
          startedAt: new Date(),
        },
      });
      if (started.count === 0) {
        throw new TRPCError({ code: 'CONFLICT', message: 'O status do trampo mudou' });
      }

      console.log(`[MATCHING] Task ${input.taskId} started`);

      return { success: true };
    }),

  /**
   * Complete task (triggers escrow hold + scheduled release)
   */
  complete: taskerProcedure
    .input(z.object({ taskId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const task = await prisma.task.findUnique({
        where: { id: input.taskId },
        include: { assignment: true, payment: true, client: { select: { id: true } } },
      });

      if (!task) {
        throw new TRPCError({ code: 'NOT_FOUND' });
      }

      if (task.assignment?.taskerId !== ctx.user.id) {
        throw new TRPCError({ code: 'FORBIDDEN' });
      }

      // Validate state transition
      assertTransition(task.status, 'COMPLETED');

      // Guarded transition: a concurrent dispute wins
      const completed = await prisma.task.updateMany({
        where: { id: input.taskId, status: 'IN_PROGRESS' },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
        },
      });
      if (completed.count === 0) {
        throw new TRPCError({ code: 'CONFLICT', message: 'O status do trampo mudou' });
      }

      // Schedule escrow release (1 hour from now)
      if (task.payment) {
        await scheduleEscrowRelease(task.payment.id);
      }

      console.log(`[MATCHING] Task ${input.taskId} completed, escrow scheduled`);

      // Send push notification to client
      notify(
        task.client.id,
        withTask(notifications.taskCompleted(task.title, ctx.user.name ?? 'Um profissional'), input.taskId)
      ).catch((err) => console.error('[MATCHING] Push notification failed:', err));

      return { success: true };
    }),

  /**
   * Cancel task
   * Handles refunds with optional penalty
   */
  cancel: protectedProcedure
    .input(
      z.object({
        taskId: z.string().uuid(),
        reason: z.string().max(500).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const task = await prisma.task.findUnique({
        where: { id: input.taskId },
        include: { assignment: true, payment: true },
      });

      if (!task) {
        throw new TRPCError({ code: 'NOT_FOUND' });
      }

      // Check if user can cancel
      const isClient = task.clientId === ctx.user.id;
      const isTasker = task.assignment?.taskerId === ctx.user.id;

      if (!isClient && !isTasker) {
        throw new TRPCError({ code: 'FORBIDDEN' });
      }

      if (!canCancel(task.status)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Não é possível cancelar neste estado',
        });
      }

      const now = new Date();
      const payment = task.payment;

      // A tasker backing out of an accepted task just releases it back to the
      // feed: no penalty for the client, and any payment stays attached to the
      // task for the next tasker.
      if (isTasker && !isClient) {
        if (task.status !== 'ACCEPTED') {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Não é possível desistir neste estado' });
        }
        await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
          const reopened = await tx.task.updateMany({
            where: { id: input.taskId, status: 'ACCEPTED' },
            data: { status: 'OPEN', acceptedAt: null },
          });
          if (reopened.count === 0) {
            throw new TRPCError({ code: 'CONFLICT', message: 'O status do trampo mudou' });
          }
          await tx.taskAssignment.deleteMany({ where: { taskId: input.taskId } });
        });
        console.log(`[MATCHING] Tasker ${ctx.user.id} released task ${input.taskId}`);
        return { success: true, penalty: 0 };
      }

      // Client cancellation: the penalty only applies once a tasker has
      // committed to the task (ACCEPTED) and it is too close to the schedule.
      const penalty =
        task.status === 'ACCEPTED'
          ? calculateCancellationPenalty(task.totalValue, task.scheduledAt, now)
          : 0;

      // 1. Claim the cancellation first with a status guard, so a concurrent
      //    start/accept can't proceed on a task we're refunding.
      const previousStatus = task.status;
      const cancellationId = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        const claimed = await tx.task.updateMany({
          where: { id: input.taskId, status: { in: ['OPEN', 'ACCEPTED'] } },
          data: { status: 'CANCELLED', cancelledAt: now },
        });
        if (claimed.count === 0) {
          throw new TRPCError({ code: 'CONFLICT', message: 'O status do trampo mudou' });
        }
        const record = await tx.cancellation.create({
          data: {
            taskId: input.taskId,
            cancelledById: ctx.user.id,
            reason: input.reason,
            penaltyAmount: penalty,
            wasPenalized: penalty > 0,
          },
        });
        return record.id;
      });

      // 2. Settle the money. If Asaas fails, roll the cancellation back so it
      //    can be retried and we never record a refund that didn't happen.
      try {
        if (payment?.status === 'CONFIRMED') {
          if (env.NODE_ENV === 'production') {
            const { refundPayment } = await import('../../integrations/asaas');
            await refundPayment({
              chargeId: payment.asaasPaymentId!,
              amount: penalty > 0 ? payment.amount - penalty : undefined, // undefined = full refund
              description: `Cancelamento: ${input.reason || 'Sem motivo informado'}`,
            });
          }
          await prisma.payment.updateMany({
            where: { id: payment.id, status: 'CONFIRMED' },
            data: { status: 'REFUNDED', refundedAt: new Date() },
          });
        } else if (payment?.status === 'PENDING') {
          // Kill the outstanding Pix so it can't be paid after cancelling
          if (env.NODE_ENV === 'production' && payment.asaasPaymentId) {
            const { cancelCharge } = await import('../../integrations/asaas');
            await cancelCharge(payment.asaasPaymentId);
          }
          await prisma.payment.updateMany({
            where: { id: payment.id, status: 'PENDING' },
            data: { status: 'EXPIRED' },
          });
        }
      } catch (error) {
        await prisma.$transaction([
          prisma.cancellation.delete({ where: { id: cancellationId } }),
          prisma.task.update({
            where: { id: input.taskId },
            data: { status: previousStatus, cancelledAt: null },
          }),
        ]);
        console.error(`[MATCHING] Refund failed for task ${input.taskId}, cancellation reverted:`, error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Não foi possível processar o estorno. Tente novamente.',
        });
      }

      console.log(`[MATCHING] Task ${input.taskId} cancelled by ${ctx.user.id}, penalty: ${penalty}`);

      return { success: true, penalty };
    }),
});

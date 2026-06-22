import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, taskerProcedure, protectedProcedure } from '../../trpc';
import { prisma, Prisma } from '@trampo/db';
import { assertTransition, canCancel } from '../../domain/state-machine';
import { calculateCancellationPenalty } from '../../domain/pricing';
import { scheduleEscrowRelease } from '../webhooks';
import { env } from '../../lib/env';
import { notify, notifications } from '../../integrations/push';

export const matchingRouter = router({
  /**
   * Accept a task
   * Uses optimistic locking to prevent double-accept
   */
  accept: taskerProcedure
    .input(z.object({ taskId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { taskId } = input;

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
          notifications.taskAccepted(result.title, ctx.user.name ?? 'Um profissional')
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

      // Check payment is confirmed (money is secured)
      if (!task.payment || task.payment.status !== 'CONFIRMED') {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'Aguardando confirmação do pagamento',
        });
      }

      await prisma.task.update({
        where: { id: input.taskId },
        data: {
          status: 'IN_PROGRESS',
          startedAt: new Date(),
        },
      });

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

      // Update task status
      await prisma.task.update({
        where: { id: input.taskId },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
        },
      });

      // Schedule escrow release (1 hour from now)
      if (task.payment) {
        await scheduleEscrowRelease(task.payment.id);
      }

      console.log(`[MATCHING] Task ${input.taskId} completed, escrow scheduled`);

      // Send push notification to client
      notify(
        task.client.id,
        notifications.taskCompleted(task.title, ctx.user.name ?? 'Um profissional')
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

      // Calculate penalty
      const penalty = calculateCancellationPenalty(
        task.totalValue,
        task.scheduledAt,
        new Date()
      );

      // Process the Asaas refund BEFORE recording the cancellation, so we never
      // mark the payment as REFUNDED for money that didn't actually move back.
      // If the refund throws, the whole cancellation aborts and can be retried.
      const refundConfirmed =
        !!task.payment && task.payment.status === 'CONFIRMED';
      if (refundConfirmed && env.NODE_ENV === 'production') {
        const { refundPayment } = await import('../../integrations/asaas');
        const refundAmount = penalty > 0 ? task.payment!.amount - penalty : undefined;

        await refundPayment({
          chargeId: task.payment!.asaasPaymentId!,
          amount: refundAmount, // undefined = full refund
          description: `Cancelamento: ${input.reason || 'Sem motivo informado'}`,
        });

        console.log(`[MATCHING] Refunded payment for task ${input.taskId}`);
      }

      await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        // Update task
        await tx.task.update({
          where: { id: input.taskId },
          data: {
            status: 'CANCELLED',
            cancelledAt: new Date(),
          },
        });

        // Create cancellation record
        await tx.cancellation.create({
          data: {
            taskId: input.taskId,
            cancelledById: ctx.user.id,
            reason: input.reason,
            penaltyAmount: penalty,
            wasPenalized: penalty > 0,
          },
        });

        // Update payment status (only meaningful once a refund was due/processed)
        if (task.payment) {
          await tx.payment.update({
            where: { id: task.payment.id },
            data: {
              status: 'REFUNDED',
              refundedAt: new Date(),
            },
          });
        }
      });

      console.log(`[MATCHING] Task ${input.taskId} cancelled by ${ctx.user.id}, penalty: ${penalty}`);

      return { success: true, penalty };
    }),
});

import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, taskerProcedure, protectedProcedure } from '../../trpc';
import { prisma } from '@trampo/db';
import { assertTransition, canCancel } from '../../domain/state-machine';
import { calculateCancellationPenalty } from '../../domain/pricing';

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
      const result = await prisma.$transaction(async (tx) => {
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

      // TODO: Send push notification to client
      // TODO: Create payment charge

      return result;
    }),

  /**
   * Start working on task
   */
  start: taskerProcedure
    .input(z.object({ taskId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const task = await prisma.task.findUnique({
        where: { id: input.taskId },
        include: { assignment: true },
      });

      if (!task) {
        throw new TRPCError({ code: 'NOT_FOUND' });
      }

      if (task.assignment?.taskerId !== ctx.user.id) {
        throw new TRPCError({ code: 'FORBIDDEN' });
      }

      // Validate state transition
      assertTransition(task.status, 'IN_PROGRESS');

      await prisma.task.update({
        where: { id: input.taskId },
        data: {
          status: 'IN_PROGRESS',
          startedAt: new Date(),
        },
      });

      return { success: true };
    }),

  /**
   * Complete task (triggers escrow hold)
   */
  complete: taskerProcedure
    .input(z.object({ taskId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const task = await prisma.task.findUnique({
        where: { id: input.taskId },
        include: { assignment: true },
      });

      if (!task) {
        throw new TRPCError({ code: 'NOT_FOUND' });
      }

      if (task.assignment?.taskerId !== ctx.user.id) {
        throw new TRPCError({ code: 'FORBIDDEN' });
      }

      // Validate state transition
      assertTransition(task.status, 'COMPLETED');

      await prisma.$transaction(async (tx) => {
        // Update task status
        await tx.task.update({
          where: { id: input.taskId },
          data: {
            status: 'COMPLETED',
            completedAt: new Date(),
          },
        });

        // Update payment to HELD
        await tx.payment.updateMany({
          where: { taskId: input.taskId },
          data: {
            status: 'HELD',
            heldAt: new Date(),
          },
        });
      });

      // TODO: Schedule escrow release job (1 hour)

      return { success: true };
    }),

  /**
   * Cancel task
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

      await prisma.$transaction(async (tx) => {
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

        // TODO: Process refund via Asaas (partial if penalty)
      });

      return { success: true, penalty };
    }),
});

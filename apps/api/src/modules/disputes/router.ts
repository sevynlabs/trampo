import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure, adminProcedure } from '../../trpc';
import { prisma, Prisma } from '@trampo/db';
import { assertTransition } from '../../domain/state-machine';
import { resolveDispute } from '../../lib/disputes';
import { isAdminUser } from '../../lib/admin';
import { notify, notifications, withTask } from '../../integrations/push';

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

        const moved = await tx.task.updateMany({
          where: { id: input.taskId, status: { in: ['IN_PROGRESS', 'COMPLETED'] } },
          data: { status: 'DISPUTED', disputedAt: new Date() },
        });
        if (moved.count === 0) {
          throw new TRPCError({ code: 'CONFLICT', message: 'O status do trampo mudou' });
        }

        // Freeze the payment so the escrow-release job won't auto-release it.
        // If the release won the race, the dispute is rolled back.
        if (task.payment) {
          const frozen = await tx.payment.updateMany({
            where: { id: task.payment.id, status: { in: ['CONFIRMED', 'HELD'] } },
            data: { status: 'DISPUTED' },
          });
          if (frozen.count === 0) {
            throw new TRPCError({
              code: 'CONFLICT',
              message: 'O pagamento deste trampo já foi liberado ou estornado',
            });
          }
        }
      });

      // Notify the other party
      const otherPartyId = isClient ? task.assignment?.taskerId : task.clientId;
      if (otherPartyId) {
        notify(
          otherPartyId,
          withTask(notifications.disputeOpened(task.title), input.taskId)
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
      return resolveDispute({
        taskId: input.taskId,
        outcome: input.outcome,
        notes: input.notes,
        resolverId: ctx.user.id,
      });
    }),
});

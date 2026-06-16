import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure } from '../../trpc';
import { prisma } from '@trampo/db';

export const paymentsRouter = router({
  /**
   * Create payment charge (Pix) for a task
   */
  createCharge: protectedProcedure
    .input(z.object({ taskId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const task = await prisma.task.findUnique({
        where: { id: input.taskId },
      });

      if (!task) {
        throw new TRPCError({ code: 'NOT_FOUND' });
      }

      if (task.clientId !== ctx.user.id) {
        throw new TRPCError({ code: 'FORBIDDEN' });
      }

      // Check for existing payment
      const existing = await prisma.payment.findUnique({
        where: { taskId: input.taskId },
      });

      if (existing) {
        return existing;
      }

      // TODO: Create charge in Asaas
      // For now, create mock payment
      const payment = await prisma.payment.create({
        data: {
          taskId: input.taskId,
          userId: ctx.user.id,
          asaasId: `mock_${Date.now()}`,
          asaasPaymentId: `pay_${Date.now()}`,
          pixCode: '00020126580014br.gov.bcb.pix0136...',
          pixQrCode: 'base64-qr-code-here',
          amount: task.totalValue,
          platformFee: task.serviceFee + Math.round(task.taskerValue * 0.15),
          taskerAmount: task.taskerValue,
          status: 'PENDING',
        },
      });

      return payment;
    }),

  /**
   * Get payment status
   */
  getStatus: protectedProcedure
    .input(z.object({ taskId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const payment = await prisma.payment.findUnique({
        where: { taskId: input.taskId },
        include: { task: true },
      });

      if (!payment) {
        throw new TRPCError({ code: 'NOT_FOUND' });
      }

      // Verify access
      if (payment.userId !== ctx.user.id) {
        throw new TRPCError({ code: 'FORBIDDEN' });
      }

      return {
        status: payment.status,
        paidAt: payment.paidAt?.toISOString() ?? null,
        heldAt: payment.heldAt?.toISOString() ?? null,
        releasedAt: payment.releasedAt?.toISOString() ?? null,
      };
    }),

  /**
   * List earnings for tasker
   */
  listForTasker: protectedProcedure.query(async ({ ctx }) => {
    // Get all payments for tasks completed by this tasker
    const payments = await prisma.payment.findMany({
      where: {
        task: {
          assignment: {
            taskerId: ctx.user.id,
          },
        },
      },
      include: {
        task: {
          select: {
            title: true,
            completedAt: true,
            category: { select: { name: true, icon: true } },
            client: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    // Calculate totals
    const released = payments
      .filter((p) => p.status === 'RELEASED')
      .reduce((sum, p) => sum + p.taskerAmount, 0);

    const held = payments
      .filter((p) => p.status === 'HELD')
      .reduce((sum, p) => sum + p.taskerAmount, 0);

    const thisMonth = payments
      .filter((p) => {
        const date = p.releasedAt ?? p.createdAt;
        const now = new Date();
        return (
          date.getMonth() === now.getMonth() &&
          date.getFullYear() === now.getFullYear()
        );
      })
      .reduce((sum, p) => sum + p.taskerAmount, 0);

    return {
      available: released,
      held,
      thisMonth,
      payments,
    };
  }),
});

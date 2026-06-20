import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure } from '../../trpc';
import { prisma } from '@trampo/db';
import { env } from '../../lib/env';
import {
  findOrCreateCustomer,
  createPixCharge,
  getPixQrCodeBase64,
  mockAsaas,
} from '../../integrations/asaas';
import { getDecryptedCpf } from '../../lib/pii';

const isDev = env.NODE_ENV === 'development';

export const paymentsRouter = router({
  /**
   * Create payment charge (Pix) for a task
   * Called when tasker accepts the task
   */
  createCharge: protectedProcedure
    .input(z.object({ taskId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const task = await prisma.task.findUnique({
        where: { id: input.taskId },
        include: {
          client: true,
          category: true,
        },
      });

      if (!task) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Task não encontrada' });
      }

      if (task.clientId !== ctx.user.id) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Você não é o cliente desta task' });
      }

      // Check for existing payment
      const existing = await prisma.payment.findUnique({
        where: { taskId: input.taskId },
      });

      if (existing) {
        // Return existing payment with Pix data
        return {
          id: existing.id,
          pixCode: existing.pixCode,
          pixQrCode: existing.pixQrCode,
          amount: existing.amount,
          status: existing.status,
        };
      }

      // In production we need the client's real CPF for the Asaas customer.
      // Validate up-front so we don't create an orphan payment record.
      let clientCpf: string | null = null;
      if (!isDev) {
        clientCpf = await getDecryptedCpf(task.clientId);
        if (!clientCpf) {
          throw new TRPCError({
            code: 'PRECONDITION_FAILED',
            message: 'Complete seu cadastro (CPF) antes de pagar',
          });
        }
      }

      // Create payment record first
      const payment = await prisma.payment.create({
        data: {
          taskId: input.taskId,
          userId: ctx.user.id,
          asaasId: '', // Will be updated
          asaasPaymentId: '', // Will be updated
          pixCode: '',
          pixQrCode: '',
          amount: task.totalValue,
          platformFee: task.serviceFee + Math.round(task.taskerValue * 0.15),
          taskerAmount: task.taskerValue,
          status: 'PENDING',
        },
      });

      try {
        let pixCode: string;
        let pixQrCode: string;
        let asaasPaymentId: string;
        let asaasCustomerId: string;

        if (isDev) {
          // Use mock in development
          const mockCharge = await mockAsaas.createPixCharge({
            externalReference: payment.id,
            amount: task.totalValue,
            description: `TRAMPO: ${task.title}`,
          });
          const mockCustomer = await mockAsaas.findOrCreateCustomer({
            externalReference: ctx.user.id,
          });

          pixCode = mockCharge.pixTransaction!.payload;
          pixQrCode = await mockAsaas.getPixQrCodeBase64();
          asaasPaymentId = mockCharge.id;
          asaasCustomerId = mockCustomer.id;
        } else {
          // Create customer in Asaas (or find existing) with the real CPF
          const customer = await findOrCreateCustomer({
            name: task.client.name || 'Cliente TRAMPO',
            cpf: clientCpf!,
            phone: task.client.phone,
            externalReference: ctx.user.id,
          });

          // Create Pix charge
          const charge = await createPixCharge({
            customerId: customer.id,
            amount: task.totalValue,
            externalReference: payment.id,
            description: `TRAMPO: ${task.title} (${task.category.name})`,
          });

          pixCode = charge.pixTransaction?.payload || '';
          pixQrCode = await getPixQrCodeBase64(charge.id);
          asaasPaymentId = charge.id;
          asaasCustomerId = customer.id;
        }

        // Update payment with Asaas data
        const updatedPayment = await prisma.payment.update({
          where: { id: payment.id },
          data: {
            asaasId: asaasCustomerId,
            asaasPaymentId,
            pixCode,
            pixQrCode,
          },
        });

        console.log(`[PAYMENTS] Created charge for task ${task.id}: ${asaasPaymentId}`);

        return {
          id: updatedPayment.id,
          pixCode,
          pixQrCode,
          amount: task.totalValue,
          status: 'PENDING',
        };
      } catch (error) {
        // Rollback payment record on error
        await prisma.payment.delete({ where: { id: payment.id } });

        console.error('[PAYMENTS] Failed to create charge:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Falha ao criar cobrança Pix',
        });
      }
    }),

  /**
   * Get payment status and details
   */
  getStatus: protectedProcedure
    .input(z.object({ taskId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const payment = await prisma.payment.findUnique({
        where: { taskId: input.taskId },
        include: {
          task: {
            include: {
              assignment: true,
            },
          },
        },
      });

      if (!payment) {
        return null;
      }

      // Verify access (client or assigned tasker)
      const isClient = payment.userId === ctx.user.id;
      const isTasker = payment.task.assignment?.taskerId === ctx.user.id;

      if (!isClient && !isTasker) {
        throw new TRPCError({ code: 'FORBIDDEN' });
      }

      return {
        id: payment.id,
        status: payment.status,
        amount: payment.amount,
        taskerAmount: payment.taskerAmount,
        pixCode: isClient ? payment.pixCode : null, // Only client sees Pix code
        pixQrCode: isClient ? payment.pixQrCode : null,
        paidAt: payment.paidAt?.toISOString() ?? null,
        heldAt: payment.heldAt?.toISOString() ?? null,
        releasedAt: payment.releasedAt?.toISOString() ?? null,
      };
    }),

  /**
   * List earnings for tasker dashboard
   */
  listForTasker: protectedProcedure.query(async ({ ctx }) => {
    // Get tasker profile
    const taskerProfile = await prisma.taskerProfile.findUnique({
      where: { userId: ctx.user.id },
    });

    if (!taskerProfile) {
      return {
        available: 0,
        held: 0,
        thisMonth: 0,
        payments: [],
      };
    }

    // Get all payments for tasks completed by this tasker
    const payments = await prisma.payment.findMany({
      where: {
        task: {
          assignment: {
            taskerId: ctx.user.id,
          },
        },
        status: { in: ['HELD', 'RELEASED'] },
      },
      include: {
        task: {
          select: {
            id: true,
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
    const available = payments
      .filter((p) => p.status === 'RELEASED')
      .reduce((sum, p) => sum + p.taskerAmount, 0);

    const held = payments
      .filter((p) => p.status === 'HELD')
      .reduce((sum, p) => sum + p.taskerAmount, 0);

    const now = new Date();
    const thisMonth = payments
      .filter((p) => {
        const date = p.releasedAt ?? p.createdAt;
        return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
      })
      .filter((p) => p.status === 'RELEASED')
      .reduce((sum, p) => sum + p.taskerAmount, 0);

    return {
      available,
      held,
      thisMonth,
      payments: payments.map((p) => ({
        id: p.id,
        taskId: p.task.id,
        taskTitle: p.task.title,
        categoryName: p.task.category.name,
        categoryIcon: p.task.category.icon,
        clientName: p.task.client.name,
        amount: p.taskerAmount,
        status: p.status,
        completedAt: p.task.completedAt?.toISOString() ?? null,
        releasedAt: p.releasedAt?.toISOString() ?? null,
      })),
    };
  }),

  /**
   * Simulate payment confirmation (DEV ONLY)
   * Used for testing the payment flow
   */
  simulatePayment: protectedProcedure
    .input(z.object({ taskId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      if (!isDev) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Only available in development',
        });
      }

      const payment = await prisma.payment.findUnique({
        where: { taskId: input.taskId },
      });

      if (!payment) {
        throw new TRPCError({ code: 'NOT_FOUND' });
      }

      if (payment.userId !== ctx.user.id) {
        throw new TRPCError({ code: 'FORBIDDEN' });
      }

      if (payment.status !== 'PENDING') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Payment already processed',
        });
      }

      // Simulate payment confirmation
      const updated = await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: 'CONFIRMED',
          paidAt: new Date(),
        },
      });

      console.log(`[PAYMENTS] Simulated payment for task ${input.taskId}`);

      return { status: updated.status };
    }),
});

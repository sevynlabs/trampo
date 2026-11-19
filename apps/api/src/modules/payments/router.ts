import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure, taskerProcedure, verifiedClientProcedure } from '../../trpc';
import { getPlatformConfig } from '../../lib/platform-settings';
import { prisma } from '@trampo/db';
import { env } from '../../lib/env';
import {
  findOrCreateCustomer,
  createPixCharge,
  getPixQrCodeBase64,
  createPixTransfer,
  mockAsaas,
} from '../../integrations/asaas';
import { getDecryptedCpf } from '../../lib/pii';
import { acquireLock, releaseLock } from '../../lib/redis';

const isDev = env.NODE_ENV === 'development';

/**
 * Money a tasker can withdraw: released earnings minus withdrawals that are
 * paid OR still pending (a pending transfer may already have gone through).
 */
export async function getAvailableBalance(userId: string, taskerProfileId: string): Promise<number> {
  const [released, withdrawals] = await Promise.all([
    prisma.payment.aggregate({
      where: { task: { assignment: { taskerId: userId } }, status: 'RELEASED' },
      _sum: { taskerAmount: true },
    }),
    prisma.withdrawal.aggregate({
      where: { taskerProfileId, status: { in: ['PENDING', 'PAID'] } },
      _sum: { amount: true },
    }),
  ]);
  return Math.max(0, (released._sum.taskerAmount ?? 0) - (withdrawals._sum.amount ?? 0));
}

/** Start of the current month in Brasília time (UTC-3, no DST). */
function startOfMonthBrt(now = new Date()): Date {
  const brt = new Date(now.getTime() - 3 * 60 * 60 * 1000);
  return new Date(Date.UTC(brt.getUTCFullYear(), brt.getUTCMonth(), 1, 3, 0, 0));
}

export const paymentsRouter = router({
  /**
   * Create payment charge (Pix) for a task
   * Called when tasker accepts the task
   */
  createCharge: verifiedClientProcedure
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

      // Only charge once a tasker accepted: the price is locked from then on
      // (tasks can only be edited while OPEN).
      if (task.status !== 'ACCEPTED') {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'O pagamento só é liberado depois que um profissional aceitar o trampo',
        });
      }

      // Check for existing payment
      let existing = await prisma.payment.findUnique({
        where: { taskId: input.taskId },
      });

      // A dead charge (expired Pix or one cancelled before payment) is replaced
      // by a fresh one; never hand back an unpayable QR code.
      if (existing && (existing.status === 'EXPIRED' || (existing.status === 'PENDING' && existing.amount !== task.totalValue))) {
        await prisma.payment.delete({ where: { id: existing.id } });
        existing = null;
      }

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
          platformFee: task.totalValue - task.taskerValue, // 5% client fee + 15% commission
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

    const where = { task: { assignment: { taskerId: ctx.user.id } } };

    // Totals come from DB aggregates (not the paginated list) and match
    // payments.balance exactly.
    const [payments, available, held, thisMonthAgg] = await Promise.all([
      prisma.payment.findMany({
        where: { ...where, status: { in: ['HELD', 'RELEASED'] } },
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
      }),
      getAvailableBalance(ctx.user.id, taskerProfile.id),
      prisma.payment.aggregate({
        where: { ...where, status: 'HELD' },
        _sum: { taskerAmount: true },
      }),
      prisma.payment.aggregate({
        where: { ...where, status: 'RELEASED', releasedAt: { gte: startOfMonthBrt() } },
        _sum: { taskerAmount: true },
      }),
    ]);

    return {
      available,
      held: held._sum.taskerAmount ?? 0,
      thisMonth: thisMonthAgg._sum.taskerAmount ?? 0,
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

  /**
   * Tasker balance: available to withdraw, pending (in escrow) and total withdrawn.
   * available = released earnings - (pending + paid withdrawals)
   */
  balance: protectedProcedure.query(async ({ ctx }) => {
    const profile = await prisma.taskerProfile.findUnique({
      where: { userId: ctx.user.id },
    });
    if (!profile) {
      return { available: 0, pending: 0, withdrawn: 0, pixKey: null };
    }

    const [available, held, withdrawals] = await Promise.all([
      getAvailableBalance(ctx.user.id, profile.id),
      prisma.payment.aggregate({
        where: { task: { assignment: { taskerId: ctx.user.id } }, status: 'HELD' },
        _sum: { taskerAmount: true },
      }),
      prisma.withdrawal.aggregate({
        where: { taskerProfileId: profile.id, status: 'PAID' },
        _sum: { amount: true },
      }),
    ]);

    const withdrawnTotal = withdrawals._sum.amount ?? 0;

    return {
      available,
      pending: held._sum.taskerAmount ?? 0,
      withdrawn: withdrawnTotal,
      pixKey: profile.pixKey,
    };
  }),

  /**
   * Request a withdrawal of the available balance to a Pix key.
   * Processes the withdrawal immediately via Asaas Pix transfer.
   */
  requestWithdrawal: taskerProcedure
    .input(
      z.object({
        amount: z.number().int().min(100), // live minimum checked below (admin settings)
        pixKey: z.string().min(3).max(140),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { withdrawalMinAmount } = await getPlatformConfig();
      if (input.amount < withdrawalMinAmount) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Saque mínimo é R$ ${(withdrawalMinAmount / 100).toFixed(2).replace('.', ',')}`,
        });
      }

      const profile = await prisma.taskerProfile.findUnique({
        where: { userId: ctx.user.id },
      });
      if (!profile) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Perfil de profissional necessário' });
      }

      // Acquire lock to prevent concurrent withdrawals
      const lockKey = `withdrawal:${ctx.user.id}`;
      // TTL comfortably above the Asaas request timeout (20s)
      const lockToken = await acquireLock(lockKey, 120);

      if (!lockToken) {
        throw new TRPCError({
          code: 'TOO_MANY_REQUESTS',
          message: 'Saque já em andamento. Aguarde alguns segundos.',
        });
      }

      try {
        // Check available balance (pending withdrawals already count against it)
        const available = await getAvailableBalance(ctx.user.id, profile.id);

        if (input.amount > available) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Valor maior que o saldo disponível',
          });
        }

        // Remember the Pix key for next time
        await prisma.taskerProfile.update({
          where: { id: profile.id },
          data: { pixKey: input.pixKey },
        });

        // Create withdrawal record with PENDING status
        const withdrawal = await prisma.withdrawal.create({
          data: {
            taskerProfileId: profile.id,
            amount: input.amount,
            pixKey: input.pixKey,
            status: 'PENDING',
          },
        });

        // Process Pix transfer via Asaas (or mock in dev)
        const transferFn = isDev ? mockAsaas.createPixTransfer : createPixTransfer;
        const result = await transferFn({
          pixKey: input.pixKey,
          amount: input.amount,
          description: `Saque TRAMPO - ${new Date().toLocaleDateString('pt-BR')}`,
        });

        if (result.success) {
          // Update withdrawal to PAID with transferId
          const updated = await prisma.withdrawal.update({
            where: { id: withdrawal.id },
            data: {
              status: 'PAID',
              asaasTransferId: result.transferId,
              paidAt: new Date(),
            },
          });

          console.log(
            `[PAYMENTS] Withdrawal ${withdrawal.id} processed: ${input.amount} → ${result.transferId}`
          );

          return { id: updated.id, status: updated.status, amount: updated.amount };
        } else if ('pending' in result && result.pending) {
          // Outcome unknown (timeout/5xx): the transfer may have been executed.
          // Keep it PENDING (still counted against the balance) for
          // reconciliation instead of letting the tasker withdraw again.
          await prisma.withdrawal.update({
            where: { id: withdrawal.id },
            data: { failureReason: `Pendente de conciliação: ${result.error ?? 'sem resposta'}` },
          });
          console.error(`[PAYMENTS] Withdrawal ${withdrawal.id} outcome unknown: ${result.error}`);
          return { id: withdrawal.id, status: 'PENDING' as const, amount: withdrawal.amount };
        } else {
          // Definitive rejection: mark FAILED so the balance is freed again
          await prisma.withdrawal.update({
            where: { id: withdrawal.id },
            data: {
              status: 'FAILED',
              failureReason: result.error || 'Unknown error',
            },
          });

          // Map error codes to user-friendly messages
          let userMessage: string;
          switch (result.errorCode) {
            case 'INVALID_PIX_KEY':
              userMessage = 'Chave Pix inválida. Verifique e tente novamente.';
              break;
            case 'INSUFFICIENT_BALANCE':
              userMessage = 'Erro temporário. Tente novamente em alguns minutos.';
              break;
            case 'DAILY_LIMIT_EXCEEDED':
              userMessage = 'Limite diário atingido. Tente novamente amanhã.';
              break;
            default:
              userMessage = 'Falha ao processar saque. Tente novamente.';
          }

          console.error(
            `[PAYMENTS] Withdrawal ${withdrawal.id} failed: ${result.error} (${result.errorCode})`
          );

          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: userMessage,
          });
        }
      } finally {
        // Always release the lock
        await releaseLock(lockKey, lockToken);
      }
    }),
});

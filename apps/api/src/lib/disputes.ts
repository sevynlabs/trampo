import { TRPCError } from '@trpc/server';
import { prisma, Prisma } from '@trampo/db';
import { env } from './env';
import { notify, notifications, withTask } from '../integrations/push';

export type DisputeOutcome = 'RELEASE' | 'REFUND';

/**
 * Resolve a dispute on a task. Shared by the mobile backoffice
 * (`disputes.resolve`, resolver = allowlisted user) and the admin panel
 * (`admin.disputes.resolve`, resolver = AdminUser). `resolverId` is stored in
 * Dispute.resolvedById (uuid without FK, so either id kind fits).
 *
 * RELEASE -> pay the tasker (escrow released). REFUND -> refund the client.
 */
export async function resolveDispute(params: {
  taskId: string;
  outcome: DisputeOutcome;
  notes?: string | null;
  resolverId: string;
}): Promise<{ success: true; outcome: DisputeOutcome }> {
  const { taskId, outcome: resolution, resolverId } = params;
  const notes = params.notes ?? undefined;

  const task = await prisma.task.findUnique({
    where: { id: taskId },
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

  if (resolution === 'RELEASE') {
    // Release to the tasker. Payouts happen through Pix withdrawals from the
    // RELEASED balance (payments.requestWithdrawal), so releasing is only a
    // status change - an extra wallet transfer here would pay twice.
    const taskerProfileId = task.assignment?.tasker.taskerProfile?.id;

    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Optimistic guard: only resolve if still OPEN. Prevents a concurrent
      // second resolve from committing (and rolls back the updates below).
      const claimed = await tx.dispute.updateMany({
        where: { taskId, status: 'OPEN' },
        data: {
          status: 'RESOLVED_RELEASED',
          resolution: notes,
          resolvedById: resolverId,
          resolvedAt: new Date(),
        },
      });
      if (claimed.count === 0) {
        throw new TRPCError({ code: 'CONFLICT', message: 'Disputa já resolvida' });
      }
      if (task.payment) {
        const released = await tx.payment.updateMany({
          where: { id: task.payment.id, status: 'DISPUTED' },
          data: { status: 'RELEASED', releasedAt: new Date() },
        });
        if (released.count === 1 && taskerProfileId) {
          await tx.taskerProfile.update({
            where: { id: taskerProfileId },
            data: {
              totalTasks: { increment: 1 },
              totalEarnings: { increment: task.payment.taskerAmount },
            },
          });
        }
      }
      await tx.task.update({
        where: { id: taskId },
        data: { status: 'RELEASED', releasedAt: new Date() },
      });
    });
  } else {
    // Refund the client. Same rule: the refund must succeed before we mark
    // the payment as refunded, otherwise we'd record a refund that never happened.
    if (isProd && task.payment?.asaasPaymentId && task.payment.paidAt && task.payment.status === 'DISPUTED') {
      const { refundPayment } = await import('../integrations/asaas');
      await refundPayment({
        chargeId: task.payment.asaasPaymentId,
        description: `Reembolso por disputa: ${task.title}`,
      });
    }

    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Optimistic guard: only resolve if still OPEN (see RELEASE branch).
      const claimed = await tx.dispute.updateMany({
        where: { taskId, status: 'OPEN' },
        data: {
          status: 'RESOLVED_REFUNDED',
          resolution: notes,
          resolvedById: resolverId,
          resolvedAt: new Date(),
        },
      });
      if (claimed.count === 0) {
        throw new TRPCError({ code: 'CONFLICT', message: 'Disputa já resolvida' });
      }
      if (task.payment) {
        await tx.payment.updateMany({
          where: { id: task.payment.id, status: 'DISPUTED' },
          data: { status: 'REFUNDED', refundedAt: new Date() },
        });
      }
      await tx.task.update({
        where: { id: taskId },
        data: { status: 'CANCELLED', cancelledAt: new Date() },
      });
    });
  }

  // Notify both parties
  const outcome = resolution === 'RELEASE' ? 'released' : 'refunded';
  for (const userId of [task.client.id, taskerId]) {
    if (userId) {
      notify(
        userId,
        withTask(notifications.disputeResolved(task.title, outcome), taskId)
      ).catch((err) => console.error('[DISPUTES] Push notification failed:', err));
    }
  }

  console.log(`[DISPUTES] Dispute on task ${taskId} resolved: ${resolution}`);

  return { success: true, outcome: resolution };
}

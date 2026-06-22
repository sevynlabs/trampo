import type { Context } from 'hono';
import { prisma } from '@trampo/db';
import { env } from '../../lib/env';
import { scheduleJob } from '../../lib/redis';
import { notify, notifications } from '../../integrations/push';

// Escrow release delay: 1 hour
const ESCROW_RELEASE_DELAY_MS = 60 * 60 * 1000;

// Job queue name
const ESCROW_RELEASE_QUEUE = 'jobs:escrow-release';

/**
 * Asaas Webhook Handler
 *
 * Payment Flow:
 * 1. PAYMENT_CONFIRMED → Payment confirmed, wait for task completion
 * 2. Task completed → status: HELD, schedule escrow release
 * 3. 1 hour later → Transfer to tasker → status: RELEASED
 *
 * CRITICAL: Always validate webhook signature before processing!
 */
export async function webhookHandler(c: Context): Promise<Response> {
  // 1. Validate signature
  const token = c.req.header('asaas-access-token');

  if (token !== env.ASAAS_WEBHOOK_TOKEN) {
    console.error('[WEBHOOK] Invalid Asaas token');
    return c.text('Unauthorized', 401);
  }

  // 2. Parse event
  let event: {
    event: string;
    payment: {
      id: string;
      customer: string;
      value: number;
      netValue: number;
      status: string;
      billingType: string;
      externalReference?: string;
    };
  };

  try {
    event = await c.req.json();
  } catch {
    return c.text('Invalid JSON', 400);
  }

  console.log(`[WEBHOOK] Received: ${event.event} for payment ${event.payment.id}`);

  // 3. Process based on event type
  try {
    switch (event.event) {
      case 'PAYMENT_CONFIRMED':
      case 'PAYMENT_RECEIVED':
        await handlePaymentConfirmed(event.payment);
        break;

      case 'PAYMENT_OVERDUE':
        await handlePaymentOverdue(event.payment);
        break;

      case 'PAYMENT_DELETED':
      case 'PAYMENT_REFUNDED':
        await handlePaymentRefunded(event.payment);
        break;

      default:
        console.log(`[WEBHOOK] Unhandled event: ${event.event}`);
    }

    return c.text('ok');
  } catch (error) {
    console.error('[WEBHOOK] Error processing:', error);
    // Return 200 to prevent Asaas from retrying
    // Log the error for investigation
    return c.text('ok');
  }
}

/**
 * Handle payment confirmed
 * Client has paid, payment is now confirmed
 */
async function handlePaymentConfirmed(paymentData: {
  id: string;
  externalReference?: string;
}) {
  // externalReference is our payment ID
  const paymentId = paymentData.externalReference;

  if (!paymentId) {
    console.error('[WEBHOOK] Missing externalReference');
    return;
  }

  // Find payment by ID
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: { task: { include: { assignment: true } } },
  });

  if (!payment) {
    console.error(`[WEBHOOK] Payment not found: ${paymentId}`);
    return;
  }

  // Idempotency check
  if (payment.status !== 'PENDING') {
    console.log(`[WEBHOOK] Payment ${paymentId} already processed: ${payment.status}`);
    return;
  }

  // Update payment status
  await prisma.payment.update({
    where: { id: paymentId },
    data: {
      status: 'CONFIRMED',
      paidAt: new Date(),
    },
  });

  console.log(`[WEBHOOK] Payment ${paymentId} confirmed for task ${payment.taskId}`);

  // Notify the tasker that payment is secured — they can now start the task
  const taskerId = payment.task.assignment?.taskerId;
  if (taskerId) {
    notify(
      taskerId,
      notifications.paymentConfirmed(payment.task.title)
    ).catch((err) => console.error('[WEBHOOK] Push notification failed:', err));
  }
}

/**
 * Handle payment overdue (Pix expired without payment)
 */
async function handlePaymentOverdue(paymentData: { externalReference?: string }) {
  const paymentId = paymentData.externalReference;
  if (!paymentId) return;

  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
  });

  if (!payment || payment.status !== 'PENDING') {
    return;
  }

  // Mark as expired
  await prisma.payment.update({
    where: { id: paymentId },
    data: {
      status: 'EXPIRED',
    },
  });

  // Revert task to OPEN so another tasker can accept
  await prisma.task.update({
    where: { id: payment.taskId },
    data: {
      status: 'OPEN',
    },
  });

  // Delete the assignment
  await prisma.taskAssignment.deleteMany({
    where: { taskId: payment.taskId },
  });

  console.log(`[WEBHOOK] Payment ${paymentId} expired, task reverted to OPEN`);
}

/**
 * Handle refund (full or partial)
 */
async function handlePaymentRefunded(paymentData: { externalReference?: string }) {
  const paymentId = paymentData.externalReference;
  if (!paymentId) return;

  await prisma.payment.update({
    where: { id: paymentId },
    data: {
      status: 'REFUNDED',
      refundedAt: new Date(),
    },
  });

  console.log(`[WEBHOOK] Payment ${paymentId} refunded`);
}

/**
 * Schedule escrow release job
 * Called when task is completed
 */
export async function scheduleEscrowRelease(paymentId: string): Promise<void> {
  // Update payment to HELD status
  await prisma.payment.update({
    where: { id: paymentId },
    data: {
      status: 'HELD',
      heldAt: new Date(),
    },
  });

  // Schedule job for 1 hour from now
  await scheduleJob(ESCROW_RELEASE_QUEUE, paymentId, { paymentId }, ESCROW_RELEASE_DELAY_MS);

  console.log(`[ESCROW] Scheduled release for payment ${paymentId} in 1 hour`);
}

/**
 * Process escrow release
 * Called by job processor after delay
 */
export async function processEscrowRelease(paymentId: string): Promise<void> {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: {
      task: {
        include: {
          assignment: {
            include: {
              tasker: {
                include: {
                  taskerProfile: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!payment) {
    console.error(`[ESCROW] Payment not found: ${paymentId}`);
    return;
  }

  // Only process HELD payments
  if (payment.status !== 'HELD') {
    console.log(`[ESCROW] Payment ${paymentId} not in HELD status: ${payment.status}`);
    return;
  }

  const taskerProfile = payment.task.assignment?.tasker.taskerProfile;

  if (!taskerProfile) {
    console.error(`[ESCROW] No tasker profile for payment ${paymentId}`);
    return;
  }

  // In production, transfer to tasker via Asaas. Idempotent: skips the transfer
  // if we already recorded one, or if Asaas already has one for this payment.
  let transferId: string | undefined = payment.asaasTransferId ?? undefined;
  if (env.NODE_ENV === 'production' && taskerProfile.asaasWalletId && !transferId) {
    const { ensureTransferToTasker } = await import('../../integrations/asaas');

    const transfer = await ensureTransferToTasker({
      walletId: taskerProfile.asaasWalletId,
      amount: payment.taskerAmount,
      description: `TRAMPO: ${payment.task.title}`,
      externalReference: paymentId,
    });
    transferId = transfer.id;
  }

  // Atomically flip HELD -> RELEASED and update the task in one transaction.
  // The optimistic `where status: 'HELD'` guard makes a concurrent fire (e.g.
  // a second processor, or a dispute that froze the payment) a no-op instead
  // of a double release.
  const released = await prisma.$transaction(async (tx) => {
    const result = await tx.payment.updateMany({
      where: { id: paymentId, status: 'HELD' },
      data: { status: 'RELEASED', releasedAt: new Date(), asaasTransferId: transferId },
    });
    if (result.count === 0) return false;

    await tx.task.update({
      where: { id: payment.taskId },
      data: { status: 'RELEASED' },
    });
    return true;
  });

  if (!released) {
    console.log(`[ESCROW] Payment ${paymentId} no longer HELD, skipping release`);
    return;
  }

  console.log(`[ESCROW] Released payment ${paymentId} - R$ ${payment.taskerAmount / 100} to tasker`);

  // Notify the tasker that the escrowed payment has been released to them
  const taskerId = payment.task.assignment?.taskerId;
  if (taskerId) {
    notify(
      taskerId,
      notifications.paymentReleased(payment.taskerAmount, payment.task.title)
    ).catch((err) => console.error('[ESCROW] Push notification failed:', err));
  }
}

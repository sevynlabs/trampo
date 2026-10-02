import type { Context } from 'hono';
import { timingSafeEqual } from 'node:crypto';
import { prisma } from '@trampo/db';
import { env } from '../../lib/env';
import { scheduleJob } from '../../lib/redis';
import { notify, notifications, withTask } from '../../integrations/push';

// Escrow release delay: 1 hour
const ESCROW_RELEASE_DELAY_MS = 60 * 60 * 1000;

// Job queue name
const ESCROW_RELEASE_QUEUE = 'jobs:escrow-release';

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}

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

  if (!token || !safeEqual(token, env.ASAAS_WEBHOOK_TOKEN)) {
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

  if (!event?.event || !event.payment?.id) {
    return c.text('Invalid payload', 400);
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
    // Every handler is idempotent, so a non-2xx lets Asaas retry instead of
    // silently losing the event (e.g. on a transient DB error).
    return c.text('error', 500);
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

  // Money arrived for a charge we no longer honour (task cancelled or the
  // charge was already given up): give it back instead of swallowing it.
  // (Asaas sends both PAYMENT_CONFIRMED and PAYMENT_RECEIVED, so only charges
  // never marked as paid qualify.)
  if (
    !payment.paidAt &&
    (payment.status === 'EXPIRED' ||
      payment.status === 'REFUNDED' ||
      payment.task.status === 'CANCELLED')
  ) {
    console.warn(`[WEBHOOK] Late payment ${paymentId} for cancelled/expired charge, refunding`);
    if (env.NODE_ENV === 'production') {
      const { refundPayment } = await import('../../integrations/asaas');
      await refundPayment({
        chargeId: paymentData.id,
        description: 'Reembolso automático: trampo cancelado',
      });
    }
    await prisma.payment.update({
      where: { id: paymentId },
      data: { status: 'REFUNDED', paidAt: new Date(), refundedAt: new Date() },
    });
    return;
  }

  // Idempotent, race-free flip PENDING -> CONFIRMED
  const confirmed = await prisma.payment.updateMany({
    where: { id: paymentId, status: 'PENDING' },
    data: {
      status: 'CONFIRMED',
      paidAt: new Date(),
    },
  });

  if (confirmed.count === 0) {
    console.log(`[WEBHOOK] Payment ${paymentId} already processed: ${payment.status}`);
    return;
  }

  console.log(`[WEBHOOK] Payment ${paymentId} confirmed for task ${payment.taskId}`);

  // Notify the tasker that payment is secured — they can now start the task
  const taskerId = payment.task.assignment?.taskerId;
  if (taskerId) {
    notify(
      taskerId,
      withTask(notifications.paymentConfirmed(payment.task.title), payment.taskId)
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

  await prisma.$transaction(async (tx) => {
    const expired = await tx.payment.updateMany({
      where: { id: paymentId, status: 'PENDING' },
      data: { status: 'EXPIRED' },
    });
    if (expired.count === 0) return;

    // Revert task to OPEN so another tasker can accept (only if it is still
    // waiting for this payment)
    const reverted = await tx.task.updateMany({
      where: { id: payment.taskId, status: 'ACCEPTED' },
      data: { status: 'OPEN', acceptedAt: null },
    });
    if (reverted.count > 0) {
      await tx.taskAssignment.deleteMany({ where: { taskId: payment.taskId } });
    }
  });

  console.log(`[WEBHOOK] Payment ${paymentId} expired, task reverted to OPEN`);
}

/**
 * Handle refund (full or partial)
 */
async function handlePaymentRefunded(paymentData: { externalReference?: string }) {
  const paymentId = paymentData.externalReference;
  if (!paymentId) return;

  // Never overwrite a payment that already reached a final state.
  const result = await prisma.payment.updateMany({
    where: { id: paymentId, status: { in: ['PENDING', 'CONFIRMED', 'HELD', 'DISPUTED'] } },
    data: {
      status: 'REFUNDED',
      refundedAt: new Date(),
    },
  });

  console.log(`[WEBHOOK] Payment ${paymentId} refunded (updated: ${result.count})`);
}

/**
 * Schedule escrow release job
 * Called when task is completed
 */
export async function scheduleEscrowRelease(paymentId: string): Promise<boolean> {
  // Only a confirmed payment can go into escrow; a refunded/disputed one must
  // never be scheduled for release.
  const held = await prisma.payment.updateMany({
    where: { id: paymentId, status: 'CONFIRMED' },
    data: {
      status: 'HELD',
      heldAt: new Date(),
    },
  });

  if (held.count === 0) {
    console.warn(`[ESCROW] Payment ${paymentId} is not CONFIRMED, release not scheduled`);
    return false;
  }

  // Schedule job for 1 hour from now
  await scheduleJob(ESCROW_RELEASE_QUEUE, paymentId, { paymentId }, ESCROW_RELEASE_DELAY_MS);

  console.log(`[ESCROW] Scheduled release for payment ${paymentId} in 1 hour`);
  return true;
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

  // Payout model: the RELEASED amount becomes withdrawable balance and the
  // tasker withdraws it via Pix (payments.requestWithdrawal). No wallet
  // transfer happens here - doing both would pay the tasker twice.

  // Atomically flip HELD -> RELEASED and update the task in one transaction.
  // The optimistic `where status: 'HELD'` guard makes a concurrent fire (e.g.
  // a second processor, or a dispute that froze the payment) a no-op instead
  // of a double release.
  const released = await prisma.$transaction(async (tx) => {
    const result = await tx.payment.updateMany({
      where: { id: paymentId, status: 'HELD' },
      data: { status: 'RELEASED', releasedAt: new Date() },
    });
    if (result.count === 0) return false;

    await tx.task.update({
      where: { id: payment.taskId },
      data: { status: 'RELEASED', releasedAt: new Date() },
    });
    await tx.taskerProfile.update({
      where: { id: taskerProfile.id },
      data: {
        totalTasks: { increment: 1 },
        totalEarnings: { increment: payment.taskerAmount },
      },
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
      withTask(notifications.paymentReleased(payment.taskerAmount, payment.task.title), payment.taskId)
    ).catch((err) => console.error('[ESCROW] Push notification failed:', err));
  }
}

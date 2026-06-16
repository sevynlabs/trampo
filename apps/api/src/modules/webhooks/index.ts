import type { Context } from 'hono';
import { prisma } from '@trampo/db';
import { env } from '../../lib/env';

/**
 * Asaas Webhook Handler
 *
 * CRITICAL: Always validate webhook signature before processing!
 * A forged webhook could mark payments as paid without money arriving.
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
      externalReference?: string;
      status: string;
      value: number;
    };
  };

  try {
    event = await c.req.json();
  } catch {
    return c.text('Invalid JSON', 400);
  }

  console.log(`[WEBHOOK] Received: ${event.event}`);

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

      case 'PAYMENT_REFUNDED':
        await handlePaymentRefunded(event.payment);
        break;

      default:
        console.log(`[WEBHOOK] Unhandled event: ${event.event}`);
    }

    return c.text('ok');
  } catch (error) {
    console.error('[WEBHOOK] Error processing:', error);
    return c.text('Error', 500);
  }
}

/**
 * Handle payment confirmed
 * Updates payment status and triggers escrow flow
 */
async function handlePaymentConfirmed(payment: {
  id: string;
  externalReference?: string;
}) {
  // Use externalReference as our payment ID
  const paymentId = payment.externalReference;

  if (!paymentId) {
    console.error('[WEBHOOK] Missing externalReference');
    return;
  }

  // Idempotency check - find by asaasId
  const existing = await prisma.payment.findFirst({
    where: { asaasPaymentId: payment.id },
  });

  if (existing?.status !== 'PENDING') {
    console.log('[WEBHOOK] Payment already processed');
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

  console.log(`[WEBHOOK] Payment ${paymentId} confirmed`);

  // TODO: Send push notification to tasker
}

/**
 * Handle payment overdue (Pix expired)
 */
async function handlePaymentOverdue(payment: { externalReference?: string }) {
  const paymentId = payment.externalReference;
  if (!paymentId) return;

  // Could update to expired status or delete
  console.log(`[WEBHOOK] Payment ${paymentId} overdue`);
}

/**
 * Handle refund
 */
async function handlePaymentRefunded(payment: { externalReference?: string }) {
  const paymentId = payment.externalReference;
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

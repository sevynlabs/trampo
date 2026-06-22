import { prisma } from '@trampo/db';
import { redis } from '../lib/redis';
import { processEscrowRelease } from '../modules/webhooks';
import { ESCROW_RELEASE_DLQ } from './escrow-processor';

/**
 * Settlement reconciler
 *
 * Safety net for the money-moving paths. Because escrow release is now
 * idempotent (ensureTransferToTasker checks Asaas before transferring, and the
 * status flip is an optimistic guard), it is safe to re-run processEscrowRelease
 * for anything that got stuck — a duplicate transfer cannot happen.
 *
 * It does two things on each sweep:
 *  1. Drains the escrow dead-letter queue (jobs that exhausted the processor),
 *     retrying each and removing it on success.
 *  2. Finds payments stuck in HELD past the release deadline (release should
 *     have happened ~1h after completion) and retries the release.
 */

const RECONCILE_INTERVAL_MS = 5 * 60 * 1000; // every 5 minutes
const ESCROW_RELEASE_DELAY_MS = 60 * 60 * 1000; // escrow holds for 1h
const STUCK_GRACE_MS = 15 * 60 * 1000; // wait an extra 15min before reconciling
const STUCK_THRESHOLD_MS = ESCROW_RELEASE_DELAY_MS + STUCK_GRACE_MS;

interface DeadJob {
  id: string;
  data: { paymentId: string };
}

export function startReconciler(): void {
  console.log('[RECONCILER] Starting settlement reconciler...');

  setInterval(async () => {
    try {
      const result = await reconcileOnce();
      if (result.dlqDrained > 0 || result.stuckRetried > 0) {
        console.log(
          `[RECONCILER] Swept: ${result.dlqDrained} DLQ job(s) drained, ${result.stuckRetried} stuck payment(s) retried`
        );
      }
    } catch (error) {
      console.error('[RECONCILER] Sweep failed:', error);
    }
  }, RECONCILE_INTERVAL_MS);
}

/**
 * Run a single reconciliation pass. Exposed for manual/triggered runs and tests.
 */
export async function reconcileOnce(): Promise<{ dlqDrained: number; stuckRetried: number }> {
  let dlqDrained = 0;
  let stuckRetried = 0;

  // 1. Drain the escrow dead-letter queue.
  const dead = await redis.lrange(ESCROW_RELEASE_DLQ, 0, -1);
  for (const jobStr of dead) {
    let job: DeadJob;
    try {
      job = JSON.parse(jobStr);
    } catch {
      // Unparseable — remove it so it doesn't wedge the queue.
      await redis.lrem(ESCROW_RELEASE_DLQ, 1, jobStr);
      continue;
    }

    try {
      await processEscrowRelease(job.data.paymentId);
      await redis.lrem(ESCROW_RELEASE_DLQ, 1, jobStr);
      dlqDrained++;
    } catch (error) {
      // Still failing — leave it in the DLQ for the next sweep / manual review.
      console.error(`[RECONCILER] DLQ job ${job.id} still failing:`, error);
    }
  }

  // 2. Find payments stuck in HELD past the release deadline.
  const deadline = new Date(Date.now() - STUCK_THRESHOLD_MS);
  const stuck = await prisma.payment.findMany({
    where: { status: 'HELD', heldAt: { lt: deadline } },
    select: { id: true, heldAt: true },
  });

  for (const payment of stuck) {
    try {
      await processEscrowRelease(payment.id);
      stuckRetried++;
    } catch (error) {
      console.error(`[RECONCILER] Failed to reconcile stuck payment ${payment.id}:`, error);
    }
  }

  // Surface anything that is still HELD after a retry attempt — these need a human.
  if (stuck.length > 0) {
    const stillStuck = await prisma.payment.count({
      where: { status: 'HELD', heldAt: { lt: deadline } },
    });
    if (stillStuck > 0) {
      console.warn(
        `[RECONCILER] ${stillStuck} payment(s) still HELD past deadline after retry — manual review needed`
      );
    }
  }

  return { dlqDrained, stuckRetried };
}

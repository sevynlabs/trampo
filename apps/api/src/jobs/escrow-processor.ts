import { redis } from '../lib/redis';
import { processEscrowRelease } from '../modules/webhooks';

const ESCROW_RELEASE_QUEUE = 'jobs:escrow-release';
export const ESCROW_RELEASE_DLQ = 'jobs:escrow-release:dead';
const POLL_INTERVAL_MS = 10000; // Check every 10 seconds

interface Job {
  id: string;
  data: {
    paymentId: string;
  };
}

/**
 * Start the escrow release job processor
 *
 * This polls Redis for scheduled jobs and processes them when due.
 * In production, consider using BullMQ or similar for more robust job processing.
 */
export function startEscrowProcessor(): void {
  console.log('[JOBS] Starting escrow processor...');

  setInterval(async () => {
    try {
      await processQueue();
    } catch (error) {
      console.error('[JOBS] Error processing queue:', error);
    }
  }, POLL_INTERVAL_MS);
}

async function processQueue(): Promise<void> {
  const now = Date.now();

  // Get all jobs that are due (score <= now)
  const jobs = await redis.zrangebyscore(ESCROW_RELEASE_QUEUE, '-inf', now);

  if (jobs.length === 0) {
    return;
  }

  console.log(`[JOBS] Processing ${jobs.length} escrow release jobs`);

  for (const jobStr of jobs) {
    let job: Job;
    try {
      job = JSON.parse(jobStr);
    } catch (error) {
      // Unparseable entry — drop it to the dead-letter queue, don't loop on it.
      console.error('[JOBS] Dropping unparseable job:', jobStr, error);
      await redis.zrem(ESCROW_RELEASE_QUEUE, jobStr);
      await redis.rpush(ESCROW_RELEASE_DLQ, jobStr);
      continue;
    }

    try {
      await processEscrowRelease(job.data.paymentId);

      // Success — remove from queue
      await redis.zrem(ESCROW_RELEASE_QUEUE, jobStr);
      console.log(`[JOBS] Completed escrow release: ${job.id}`);
    } catch (error) {
      // The release moves money and is NOT idempotent (a retry could transfer
      // twice if the transfer succeeded but the DB write failed). So we do NOT
      // auto-retry: dead-letter the job for manual/reconciliation review instead
      // of silently dropping it (the previous behavior).
      console.error(`[JOBS] Escrow release failed, dead-lettering ${job.id}:`, error);
      await redis.zrem(ESCROW_RELEASE_QUEUE, jobStr);
      await redis.rpush(ESCROW_RELEASE_DLQ, jobStr);
    }
  }
}

/**
 * Get pending job count (for monitoring)
 */
export async function getPendingJobCount(): Promise<number> {
  return redis.zcard(ESCROW_RELEASE_QUEUE);
}

/**
 * Get next scheduled job time
 */
export async function getNextJobTime(): Promise<Date | null> {
  const result = await redis.zrange(ESCROW_RELEASE_QUEUE, 0, 0, 'WITHSCORES');
  if (result.length < 2) return null;
  return new Date(parseInt(result[1]));
}

/**
 * Number of dead-lettered escrow jobs (for monitoring/backoffice)
 */
export async function getDeadLetterCount(): Promise<number> {
  return redis.llen(ESCROW_RELEASE_DLQ);
}

/**
 * List dead-lettered escrow jobs (parsed where possible) for the backoffice.
 */
export async function getDeadLetterJobs(limit = 50): Promise<unknown[]> {
  const raw = await redis.lrange(ESCROW_RELEASE_DLQ, 0, limit - 1);
  return raw.map((s) => {
    try {
      return JSON.parse(s);
    } catch {
      return { raw: s };
    }
  });
}

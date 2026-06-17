import { redis } from '../lib/redis';
import { processEscrowRelease } from '../modules/webhooks';

const ESCROW_RELEASE_QUEUE = 'jobs:escrow-release';
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
    try {
      const job: Job = JSON.parse(jobStr);

      // Process the job
      await processEscrowRelease(job.data.paymentId);

      // Remove from queue
      await redis.zrem(ESCROW_RELEASE_QUEUE, jobStr);

      console.log(`[JOBS] Completed escrow release: ${job.id}`);
    } catch (error) {
      console.error(`[JOBS] Failed to process job:`, error);
      // Move to dead letter queue or retry
      await redis.zrem(ESCROW_RELEASE_QUEUE, jobStr);
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

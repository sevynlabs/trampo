import { randomUUID } from 'node:crypto';
import { Redis } from 'ioredis';
import { env } from './env';

// Parse Upstash URL
const url = new URL(env.UPSTASH_REDIS_REST_URL);

export const redis = new Redis({
  host: url.hostname,
  port: parseInt(url.port) || 6379,
  password: env.UPSTASH_REDIS_REST_TOKEN,
  tls: url.protocol === 'https:' ? {} : undefined,
  maxRetriesPerRequest: 3,
  retryStrategy: (times) => {
    if (times > 3) return null;
    return Math.min(times * 200, 1000);
  },
});

redis.on('error', (err) => {
  console.error('Redis connection error:', err);
});

redis.on('connect', () => {
  console.log('✅ Redis connected');
});

/**
 * Rate limiter using Redis
 * Returns true if request should be allowed, false if rate limited
 */
export async function checkRateLimit(
  key: string,
  limit: number,
  windowSeconds: number
): Promise<boolean> {
  const current = await redis.incr(key);

  if (current === 1) {
    await redis.expire(key, windowSeconds);
  }

  return current <= limit;
}

/**
 * Add job to delay queue (for escrow release)
 */
export async function scheduleJob(
  queue: string,
  jobId: string,
  data: Record<string, unknown>,
  delayMs: number
): Promise<void> {
  const executeAt = Date.now() + delayMs;
  await redis.zadd(queue, executeAt, JSON.stringify({ id: jobId, data }));
}

/**
 * Acquire a distributed lock using Redis SET NX
 * Returns true if lock was acquired, false if already locked
 */
export async function acquireLock(
  key: string,
  ttlSeconds: number
): Promise<string | null> {
  const token = randomUUID();
  const result = await redis.set(key, token, 'EX', ttlSeconds, 'NX');
  return result === 'OK' ? token : null;
}

/**
 * Release a distributed lock, but only if we still own it (compare-and-delete),
 * so an expired lock re-acquired by another request is never deleted.
 */
export async function releaseLock(key: string, token: string): Promise<void> {
  await redis.eval(
    "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end",
    1,
    key,
    token
  );
}

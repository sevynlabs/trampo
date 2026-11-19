import { z } from 'zod';

/** Shared period filter for admin lists, stats and reports. */
export const periodSchema = z.enum(['7d', '30d', '90d', '12m', 'all']).default('30d');
export type Period = z.infer<typeof periodSchema>;

const DAY_MS = 24 * 60 * 60 * 1000;

export const PERIOD_DAYS: Record<Exclude<Period, 'all'>, number> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
  '12m': 365,
};

/** Start of the period (null for 'all' = no lower bound). */
export function periodSince(period: Period, now: Date = new Date()): Date | null {
  if (period === 'all') return null;
  return new Date(now.getTime() - PERIOD_DAYS[period] * DAY_MS);
}

/**
 * Current window [since, now) and the previous window of equal length
 * immediately before it. For 'all' there is no previous window.
 */
export function periodWindows(period: Period, now: Date = new Date()) {
  const since = periodSince(period, now);
  if (!since) return { current: { since: null, until: now }, previous: null };
  const len = now.getTime() - since.getTime();
  return {
    current: { since, until: now },
    previous: { since: new Date(since.getTime() - len), until: since },
  };
}

/** Prisma-compatible `{ gte }` date filter, or undefined for 'all'. */
export function sinceFilter(period: Period): { gte: Date } | undefined {
  const since = periodSince(period);
  return since ? { gte: since } : undefined;
}

/** Time-bucket granularity used by the report series. */
export function periodBucket(period: Period): 'day' | 'week' | 'month' {
  if (period === '7d' || period === '30d') return 'day';
  if (period === '90d') return 'week';
  return 'month';
}

/** Standard pagination input shared by admin lists. */
export const paginationShape = {
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(120).optional(),
  sortDir: z.enum(['asc', 'desc']).default('desc'),
};

/** Short human code from a uuid, e.g. "#A1B2C3D4". */
export function shortCode(id: string): string {
  return `#${id.replace(/-/g, '').slice(0, 8).toUpperCase()}`;
}

/** Normalises a search term that may be a short code ("#a1b2c3d4" / "a1b2c3d4"). */
export function codePrefix(search: string): string | null {
  const s = search.trim().replace(/^#/, '').toLowerCase();
  return /^[0-9a-f]{4,8}$/.test(s) ? s : null;
}

/**
 * uuid columns don't support LIKE through Prisma, so a hex prefix becomes a
 * lexical range: [prefix000..., prefixfff...].
 */
export function uuidPrefixRange(prefix: string): { gte: string; lte: string } {
  const fmt = (hex: string) =>
    `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  return {
    gte: fmt(prefix.padEnd(32, '0')),
    lte: fmt(prefix.padEnd(32, 'f')),
  };
}

export function toNum(v: unknown): number {
  if (typeof v === 'bigint') return Number(v);
  if (typeof v === 'number') return v;
  return Number(v ?? 0);
}

/** Payment statuses that represent money actually collected from the client. */
export const PAID_STATUSES = ['CONFIRMED', 'HELD', 'RELEASED'] as const;

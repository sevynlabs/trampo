import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { prisma } from '@trampo/db';
import { TASK_CONSTANTS } from '@trampo/contracts';
import type { PricingRates } from '../domain/pricing';

export const SETTINGS_KEY = 'platform';

/** Minimum withdrawal enforced by payments.requestWithdrawal (centavos). */
const WITHDRAWAL_MIN_AMOUNT = 1000;

/**
 * Platform settings stored as JSON in IntegrationSetting(key='platform').
 *
 * These values are LIVE: pricing (tasks.create/update), the withdrawal
 * minimum and maintenance mode read them through getPlatformConfig()
 * (cached for a few seconds). Fee changes apply to NEW tasks only — existing
 * tasks keep the amounts stored when they were created.
 */
const percent = z.number().min(0).max(100);
export const platformSettingsSchema = z.object({
  platformName: z.string().trim().min(1).max(60).default('Trampo'),
  supportEmail: z.string().trim().email().or(z.literal('')).default(''),
  supportPhone: z.string().trim().max(30).default(''),
  clientFeePercent: percent.default(TASK_CONSTANTS.CLIENT_FEE * 100),
  taskerFeePercent: percent.default(TASK_CONSTANTS.TASKER_FEE * 100),
  urgencyFeePercent: percent.default(TASK_CONSTANTS.URGENCY_FEE * 100),
  minTaskValue: z.number().int().min(TASK_CONSTANTS.ABSOLUTE_MIN_VALUE).max(TASK_CONSTANTS.MAX_VALUE).default(TASK_CONSTANTS.MIN_VALUE),
  withdrawalMinAmount: z.number().int().min(100).default(WITHDRAWAL_MIN_AMOUNT),
  notifications: z
    .object({
      emailOnNewDispute: z.boolean().default(true),
      emailOnKycSubmitted: z.boolean().default(true),
      dailySummary: z.boolean().default(false),
    })
    .default({}),
  maintenanceMode: z.boolean().default(false),
});

export type PlatformSettings = z.infer<typeof platformSettingsSchema>;

/** Stored JSON merged over defaults; invalid stored fields fall back to defaults. */
export async function getPlatformSettings(): Promise<{
  settings: PlatformSettings;
  updatedAt: string | null;
  updatedById: string | null;
}> {
  const row = await prisma.integrationSetting.findUnique({ where: { key: SETTINGS_KEY } });
  const stored = (row?.value && typeof row.value === 'object' && !Array.isArray(row.value) ? row.value : {}) as Record<
    string,
    unknown
  >;
  const parsed = platformSettingsSchema.safeParse(stored);
  let settings: PlatformSettings;
  if (parsed.success) {
    settings = parsed.data;
  } else {
    // Drop the offending top-level keys and keep the rest.
    const bad = new Set(parsed.error.issues.map((i) => String(i.path[0])));
    const cleaned = Object.fromEntries(Object.entries(stored).filter(([k]) => !bad.has(k)));
    settings = platformSettingsSchema.parse(cleaned);
  }
  return {
    settings,
    updatedAt: row?.updatedAt.toISOString() ?? null,
    updatedById: row?.updatedById ?? null,
  };
}


// ---------------------------------------------------------------------------
// Live config for the rest of the API (pricing, withdrawals, maintenance)
// ---------------------------------------------------------------------------

const CACHE_MS = 15_000;
let cache: { at: number; value: PlatformSettings } | null = null;

/** Platform settings with a short in-memory cache (hot paths: pricing, middleware). */
export async function getPlatformConfig(): Promise<PlatformSettings> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.value;
  try {
    const { settings } = await getPlatformSettings();
    cache = { at: Date.now(), value: settings };
    return settings;
  } catch (err) {
    // Never block pricing because the settings row can't be read: fall back.
    console.error('[SETTINGS] failed to load platform settings, using defaults', err);
    return cache?.value ?? platformSettingsSchema.parse({});
  }
}

/** Call after the admin saves settings so changes apply immediately. */
export function invalidatePlatformConfig() {
  cache = null;
}

export async function getPricingRates(): Promise<PricingRates> {
  const s = await getPlatformConfig();
  return {
    clientFee: s.clientFeePercent / 100,
    taskerFee: s.taskerFeePercent / 100,
    urgencyFee: s.urgencyFeePercent / 100,
    minValue: s.minTaskValue,
  };
}

/** Blocks NEW actions (post a task, accept a task) while maintenance mode is on. */
export async function assertNotInMaintenance() {
  const s = await getPlatformConfig();
  if (s.maintenanceMode) {
    throw new TRPCError({
      code: 'SERVICE_UNAVAILABLE',
      message: 'O Trampo está em manutenção. Tente novamente em alguns minutos.',
    });
  }
}

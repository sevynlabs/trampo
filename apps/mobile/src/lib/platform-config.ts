import { TASK_CONSTANTS } from '@trampo/contracts';
import { trpc } from './trpc';

/** Defaults used until the API answers (and if it can't be reached). */
export type PlatformConfig = {
  clientFee: number;
  taskerFee: number;
  urgencyFee: number;
  minTaskValue: number;
  maxTaskValue: number;
  withdrawalMinAmount: number;
  maintenanceMode: boolean;
  minAppVersion: string;
  supportEmail: string | null;
  supportPhone: string | null;
};

export const DEFAULT_PLATFORM_CONFIG: PlatformConfig = {
  clientFee: TASK_CONSTANTS.CLIENT_FEE,
  taskerFee: TASK_CONSTANTS.TASKER_FEE,
  urgencyFee: TASK_CONSTANTS.URGENCY_FEE,
  minTaskValue: TASK_CONSTANTS.MIN_VALUE,
  maxTaskValue: TASK_CONSTANTS.MAX_VALUE,
  withdrawalMinAmount: 1000,
  maintenanceMode: false,
  minAppVersion: '0.0.0',
  supportEmail: null,
  supportPhone: null,
};

/**
 * Live platform config set in the admin (fees, minimums, maintenance).
 * The server always recalculates prices; this is for the on-screen preview.
 */
export function usePlatformConfig(): PlatformConfig {
  const { data } = trpc.config.public.useQuery(undefined, { staleTime: 60_000, refetchOnWindowFocus: true });
  return data ?? DEFAULT_PLATFORM_CONFIG;
}

/** "5%" / "30%" */
export const pct = (fraction: number) => `${Math.round(fraction * 1000) / 10}%`.replace('.', ',');

import { TASK_CONSTANTS } from '@trampo/contracts';
import { router, publicProcedure } from '../../trpc';
import { getPlatformConfig } from '../../lib/platform-settings';

/**
 * Public platform configuration for the app: live fees (price preview),
 * value limits, withdrawal minimum, maintenance mode and support contacts.
 * Safe to expose (no secrets).
 */
export const configRouter = router({
  public: publicProcedure.query(async () => {
    const s = await getPlatformConfig();
    return {
      clientFee: s.clientFeePercent / 100,
      taskerFee: s.taskerFeePercent / 100,
      urgencyFee: s.urgencyFeePercent / 100,
      minTaskValue: s.minTaskValue,
      maxTaskValue: TASK_CONSTANTS.MAX_VALUE,
      withdrawalMinAmount: s.withdrawalMinAmount,
      maintenanceMode: s.maintenanceMode,
      minAppVersion: s.minAppVersion,
      supportEmail: s.supportEmail || null,
      supportPhone: s.supportPhone || null,
    };
  }),
});

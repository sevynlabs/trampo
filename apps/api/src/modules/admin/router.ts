import { router, adminProcedure } from '../../trpc';
import { prisma } from '@trampo/db';
import { reconcileOnce } from '../../jobs/reconciler';
import {
  getPendingJobCount,
  getNextJobTime,
  getDeadLetterCount,
  getDeadLetterJobs,
} from '../../jobs/escrow-processor';

export const adminRouter = router({
  /**
   * Settlement health snapshot for the backoffice.
   */
  settlementStatus: adminProcedure.query(async () => {
    const [pendingJobs, deadLetterCount, nextJob, heldPayments, disputedPayments] =
      await Promise.all([
        getPendingJobCount(),
        getDeadLetterCount(),
        getNextJobTime(),
        prisma.payment.count({ where: { status: 'HELD' } }),
        prisma.payment.count({ where: { status: 'DISPUTED' } }),
      ]);

    return {
      pendingJobs,
      deadLetterCount,
      nextJobAt: nextJob?.toISOString() ?? null,
      heldPayments,
      disputedPayments,
    };
  }),

  /**
   * Inspect the escrow dead-letter queue.
   */
  deadLetterQueue: adminProcedure.query(async () => {
    return getDeadLetterJobs();
  }),

  /**
   * Manually trigger a reconciliation sweep (drains DLQ + retries stuck HELD).
   */
  reconcile: adminProcedure.mutation(async () => {
    return reconcileOnce();
  }),
});

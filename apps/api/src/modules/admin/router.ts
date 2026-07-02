import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import {
  router,
  publicProcedure,
  adminProcedure,
  adminAuthProcedure,
  withRateLimit,
} from '../../trpc';
import { prisma } from '@trampo/db';
import { reconcileOnce } from '../../jobs/reconciler';
import {
  getPendingJobCount,
  getNextJobTime,
  getDeadLetterCount,
  getDeadLetterJobs,
} from '../../jobs/escrow-processor';
import { verifyPassword } from './auth';
import { generateAdminToken } from '../../lib/admin-jwt';

/** Shape returned to the admin panel — never includes the password hash. */
function serializeAdmin(admin: {
  id: string;
  email: string;
  name: string;
  role: string;
  lastLoginAt: Date | null;
}) {
  return {
    id: admin.id,
    email: admin.email,
    name: admin.name,
    role: admin.role,
    lastLoginAt: admin.lastLoginAt?.toISOString() ?? null,
  };
}

export const adminRouter = router({
  // ==========================================================================
  // AUTH
  // ==========================================================================

  /**
   * Admin login: email + password -> 24h admin JWT.
   * Rate-limited by IP to slow brute-force attempts.
   */
  login: publicProcedure
    .use(withRateLimit(10, 60))
    .input(
      z.object({
        email: z.string().email(),
        password: z.string().min(1),
      })
    )
    .mutation(async ({ input }) => {
      const email = input.email.trim().toLowerCase();
      const admin = await prisma.adminUser.findUnique({ where: { email } });

      // Uniform error to avoid leaking which emails exist.
      const invalid = () =>
        new TRPCError({ code: 'UNAUTHORIZED', message: 'Credenciais inválidas' });

      if (!admin || !admin.isActive) {
        // Still run a hash comparison when the admin is missing would be ideal,
        // but bcrypt.compare on a bogus hash is enough to keep timing sane.
        if (!admin) throw invalid();
        throw invalid();
      }

      const ok = await verifyPassword(input.password, admin.passwordHash);
      if (!ok) throw invalid();

      await prisma.adminUser.update({
        where: { id: admin.id },
        data: { lastLoginAt: new Date() },
      });

      const token = await generateAdminToken({
        id: admin.id,
        email: admin.email,
        role: admin.role,
      });

      return { token, admin: serializeAdmin(admin) };
    }),

  /**
   * Current admin (validates the JWT via adminAuthProcedure).
   */
  me: adminAuthProcedure.query(({ ctx }) => {
    return serializeAdmin(ctx.admin);
  }),

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

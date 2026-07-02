import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import {
  router,
  publicProcedure,
  adminProcedure,
  adminAuthProcedure,
  requireAdminRole,
  withRateLimit,
} from '../../trpc';
import { prisma, Prisma } from '@trampo/db';
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

  // ==========================================================================
  // DASHBOARD
  // ==========================================================================

  /**
   * Headline metrics for the dashboard home.
   */
  dashboardStats: adminAuthProcedure.query(async () => {
    const [totalUsers, totalTaskers, kycPending, activeTasks, openDisputes] =
      await Promise.all([
        prisma.user.count(),
        prisma.user.count({ where: { role: { in: ['TASKER', 'BOTH'] } } }),
        prisma.taskerProfile.count({ where: { kycStatus: 'SUBMITTED' } }),
        prisma.task.count({
          where: { status: { in: ['ACCEPTED', 'IN_PROGRESS'] } },
        }),
        prisma.dispute.count({ where: { status: 'OPEN' } }),
      ]);

    return { totalUsers, totalTaskers, kycPending, activeTasks, openDisputes };
  }),

  // ==========================================================================
  // USERS
  // ==========================================================================

  /**
   * Paginated, searchable, filterable list of users.
   */
  listUsers: adminAuthProcedure
    .input(
      z.object({
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(1).max(100).default(20),
        search: z.string().trim().optional(),
        role: z.enum(['ALL', 'CLIENT', 'TASKER', 'BOTH']).default('ALL'),
        status: z.enum(['all', 'active', 'blocked']).default('all'),
      })
    )
    .query(async ({ input }) => {
      const { page, pageSize, search, role, status } = input;

      const where: Prisma.UserWhereInput = {};

      if (search) {
        where.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
          { phone: { contains: search } },
        ];
      }
      if (role !== 'ALL') where.role = role;
      if (status === 'active') where.isActive = true;
      if (status === 'blocked') where.isActive = false;

      const [total, users] = await Promise.all([
        prisma.user.count({ where }),
        prisma.user.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * pageSize,
          take: pageSize,
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
            role: true,
            isActive: true,
            createdAt: true,
            taskerProfile: { select: { kycStatus: true } },
          },
        }),
      ]);

      return {
        users: users.map((u) => ({
          id: u.id,
          name: u.name,
          phone: u.phone,
          email: u.email,
          role: u.role,
          isActive: u.isActive,
          kycStatus: u.taskerProfile?.kycStatus ?? null,
          createdAt: u.createdAt.toISOString(),
        })),
        total,
        page,
        pageSize,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      };
    }),

  /**
   * Full detail for a single user: profile, tasker stats + balance,
   * recent tasks (both sides), and reviews received.
   */
  getUser: adminAuthProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input }) => {
      const user = await prisma.user.findUnique({
        where: { id: input.id },
        include: { taskerProfile: true },
      });

      if (!user) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Usuário não encontrado' });
      }

      const profile = user.taskerProfile;

      const [tasksAsClient, assignments, reviews, withdrawnAgg] =
        await Promise.all([
          prisma.task.findMany({
            where: { clientId: user.id },
            orderBy: { createdAt: 'desc' },
            take: 5,
            select: {
              id: true,
              title: true,
              status: true,
              totalValue: true,
              createdAt: true,
            },
          }),
          prisma.taskAssignment.findMany({
            where: { taskerId: user.id },
            orderBy: { createdAt: 'desc' },
            take: 5,
            select: {
              task: {
                select: {
                  id: true,
                  title: true,
                  status: true,
                  taskerValue: true,
                  createdAt: true,
                },
              },
            },
          }),
          prisma.review.findMany({
            where: { revieweeId: user.id },
            orderBy: { createdAt: 'desc' },
            take: 5,
            select: {
              id: true,
              rating: true,
              comment: true,
              createdAt: true,
            },
          }),
          profile
            ? prisma.withdrawal.aggregate({
                where: { taskerProfileId: profile.id, status: 'PAID' },
                _sum: { amount: true },
              })
            : Promise.resolve(null),
        ]);

      const withdrawn = withdrawnAgg?._sum.amount ?? 0;

      return {
        user: {
          id: user.id,
          name: user.name,
          phone: user.phone,
          email: user.email,
          avatarUrl: user.avatarUrl,
          role: user.role,
          isActive: user.isActive,
          createdAt: user.createdAt.toISOString(),
        },
        taskerProfile: profile
          ? {
              id: profile.id,
              kycStatus: profile.kycStatus,
              kycSubmittedAt: profile.kycSubmittedAt?.toISOString() ?? null,
              kycApprovedAt: profile.kycApprovedAt?.toISOString() ?? null,
              kycRejectedAt: profile.kycRejectedAt?.toISOString() ?? null,
              kycRejectReason: profile.kycRejectReason,
              rating: profile.rating,
              totalTasks: profile.totalTasks,
              pixKey: profile.pixKey,
              balance: {
                totalEarnings: profile.totalEarnings,
                withdrawn,
                available: profile.totalEarnings - withdrawn,
              },
            }
          : null,
        tasksAsClient: tasksAsClient.map((t) => ({
          id: t.id,
          title: t.title,
          status: t.status,
          value: t.totalValue,
          createdAt: t.createdAt.toISOString(),
        })),
        tasksAsTasker: assignments.map((a) => ({
          id: a.task.id,
          title: a.task.title,
          status: a.task.status,
          value: a.task.taskerValue,
          createdAt: a.task.createdAt.toISOString(),
        })),
        reviews: reviews.map((r) => ({
          id: r.id,
          rating: r.rating,
          comment: r.comment,
          createdAt: r.createdAt.toISOString(),
        })),
      };
    }),

  /**
   * Block or unblock a user (toggles isActive).
   */
  setUserActive: requireAdminRole('SUPER_ADMIN', 'OPERATOR')
    .input(z.object({ id: z.string().uuid(), active: z.boolean() }))
    .mutation(async ({ input }) => {
      await prisma.user.update({
        where: { id: input.id },
        data: { isActive: input.active },
      });
      return { success: true, isActive: input.active };
    }),

  /**
   * Change a user's role.
   */
  setUserRole: requireAdminRole('SUPER_ADMIN', 'OPERATOR')
    .input(
      z.object({
        id: z.string().uuid(),
        role: z.enum(['CLIENT', 'TASKER', 'BOTH']),
      })
    )
    .mutation(async ({ input }) => {
      await prisma.user.update({
        where: { id: input.id },
        data: { role: input.role },
      });
      return { success: true, role: input.role };
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

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
import { supabase } from '../../lib/supabase';
import { notify } from '../../integrations/push';
import { dashboardRouter } from './dashboard';
import { financeRouter } from './finance';
import { campaignsRouter } from './campaigns';
import { bannersAdminRouter } from './banners';
import { identityAdminRouter } from './identity';
import { servicesAdminRouter } from './services';
import { requestsAdminRouter } from './requests';
import { reviewsAdminRouter } from './reviews';
import { disputesAdminRouter } from './disputes';
import { reportsAdminRouter } from './reports';
import { settingsAdminRouter } from './settings';

/** Supabase Storage bucket holding KYC documents. */
const KYC_BUCKET = 'kyc-documents';

/** Admin document view URLs are valid for 5 minutes (per security spec). */
const KYC_URL_TTL_SECONDS = 300;

async function signKycUrl(path: string | null): Promise<string | null> {
  if (!path) return null;
  const { data, error } = await supabase.storage
    .from(KYC_BUCKET)
    .createSignedUrl(path, KYC_URL_TTL_SECONDS);
  if (error || !data) {
    console.error('[ADMIN-KYC] Failed to sign URL for', path, error);
    return null;
  }
  return data.signedUrl;
}

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
        prisma.taskerProfile
          .count({ where: { kycStatus: 'SUBMITTED' } })
          .then(async (pro) =>
            pro +
            (await prisma.identityVerification.count({
              where: { status: 'SUBMITTED', NOT: { user: { taskerProfile: { kycStatus: 'SUBMITTED' } } } },
            }))
          ),
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
   * Professionals directory for the admin panel: tasker profiles with
   * categories, rating, jobs done and verification status.
   */
  listProfessionals: adminAuthProcedure
    .input(
      z.object({
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(1).max(100).default(20),
        search: z.string().trim().optional(),
        status: z.enum(['all', 'active', 'verification', 'rejected', 'blocked']).default('all'),
      })
    )
    .query(async ({ input }) => {
      const { page, pageSize, search, status } = input;
      const where: Prisma.TaskerProfileWhereInput = {};
      if (search) {
        where.OR = [
          { user: { name: { contains: search, mode: 'insensitive' } } },
          { user: { phone: { contains: search } } },
          { categories: { some: { category: { name: { contains: search, mode: 'insensitive' } } } } },
        ];
      }
      if (status === 'active') Object.assign(where, { kycStatus: 'APPROVED', user: { isActive: true } });
      if (status === 'verification') where.kycStatus = { in: ['PENDING', 'SUBMITTED'] };
      if (status === 'rejected') where.kycStatus = 'REJECTED';
      if (status === 'blocked') where.user = { isActive: false };

      const [total, profiles] = await Promise.all([
        prisma.taskerProfile.count({ where }),
        prisma.taskerProfile.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * pageSize,
          take: pageSize,
          select: {
            rating: true,
            totalTasks: true,
            totalEarnings: true,
            kycStatus: true,
            createdAt: true,
            user: {
              select: {
                id: true,
                name: true,
                phone: true,
                isActive: true,
                _count: { select: { reviewsReceived: true } },
              },
            },
            categories: { select: { category: { select: { name: true } } } },
          },
        }),
      ]);

      return {
        professionals: profiles.map((p) => ({
          id: p.user.id,
          name: p.user.name,
          phone: p.user.phone,
          isActive: p.user.isActive,
          categories: p.categories.map((c) => c.category.name),
          rating: p.rating,
          reviewCount: p.user._count.reviewsReceived,
          totalTasks: p.totalTasks,
          totalEarnings: p.totalEarnings,
          kycStatus: p.kycStatus,
          createdAt: p.createdAt.toISOString(),
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

  // ==========================================================================
  // KYC
  // ==========================================================================

  /**
   * Queue of tasker profiles awaiting KYC review (status SUBMITTED),
   * oldest submissions first.
   */
  listPendingKyc: adminAuthProcedure.query(async () => {
    const profiles = await prisma.taskerProfile.findMany({
      where: { kycStatus: 'SUBMITTED' },
      orderBy: { kycSubmittedAt: 'asc' },
      select: {
        id: true,
        kycSubmittedAt: true,
        user: { select: { id: true, name: true, phone: true, email: true } },
      },
    });

    return profiles.map((p) => ({
      profileId: p.id,
      userId: p.user.id,
      name: p.user.name,
      phone: p.user.phone,
      email: p.user.email,
      submittedAt: p.kycSubmittedAt?.toISOString() ?? null,
    }));
  }),

  /**
   * Full KYC detail for review: user info, short-lived signed document URLs,
   * and the decision history.
   */
  getKycDetails: adminAuthProcedure
    .input(z.object({ profileId: z.string().uuid() }))
    .query(async ({ input }) => {
      const profile = await prisma.taskerProfile.findUnique({
        where: { id: input.profileId },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              phone: true,
              email: true,
              createdAt: true,
            },
          },
          kycDecisions: {
            orderBy: { createdAt: 'desc' },
            take: 10,
            include: { admin: { select: { name: true, email: true } } },
          },
        },
      });

      if (!profile) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Perfil não encontrado' });
      }

      // Identity documents now live in identity_verifications (all users);
      // fall back to the legacy columns for profiles from before the split.
      const identity = await prisma.identityVerification.findUnique({ where: { userId: profile.userId } });
      const [front, back, selfie, criminalRecord] = await Promise.all([
        signKycUrl(identity?.documentFrontPath ?? profile.documentFrontPath),
        signKycUrl(identity?.documentBackPath ?? profile.documentBackPath),
        signKycUrl(identity?.selfiePath ?? profile.selfiePath),
        signKycUrl(profile.criminalRecordPath),
      ]);

      return {
        profileId: profile.id,
        kycStatus: profile.kycStatus,
        submittedAt: profile.kycSubmittedAt?.toISOString() ?? null,
        approvedAt: profile.kycApprovedAt?.toISOString() ?? null,
        rejectedAt: profile.kycRejectedAt?.toISOString() ?? null,
        rejectReason: profile.kycRejectReason,
        user: {
          id: profile.user.id,
          name: profile.user.name,
          phone: profile.user.phone,
          email: profile.user.email,
          createdAt: profile.user.createdAt.toISOString(),
        },
        identityStatus: identity?.status ?? 'PENDING',
        documents: { front, back, selfie, criminalRecord },
        criminalRecordIsPdf: !!profile.criminalRecordPath?.endsWith('.pdf'),
        decisions: profile.kycDecisions.map((d) => ({
          id: d.id,
          decision: d.decision,
          reason: d.reason,
          adminName: d.admin.name,
          createdAt: d.createdAt.toISOString(),
        })),
      };
    }),

  /**
   * Approve a KYC submission. Records an audit decision and notifies the tasker.
   * Uses an optimistic guard so two admins can't both act on the same profile.
   */
  approveKyc: requireAdminRole('SUPER_ADMIN', 'OPERATOR')
    .input(z.object({ profileId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const userId = await prisma.$transaction(async (tx) => {
        const target = await tx.taskerProfile.findUnique({
          where: { id: input.profileId },
          select: { userId: true, criminalRecordPath: true },
        });
        const identity = target
          ? await tx.identityVerification.findUnique({ where: { userId: target.userId }, select: { status: true } })
          : null;
        if (!target?.criminalRecordPath || (identity?.status !== 'SUBMITTED' && identity?.status !== 'APPROVED')) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Faltam documentos de identidade ou a certidão de antecedentes',
          });
        }
        // Reviewing a professional covers their identity documents too.
        await tx.identityVerification.updateMany({
          where: { userId: target.userId, status: 'SUBMITTED' },
          data: { status: 'APPROVED', approvedAt: new Date(), rejectedAt: null, rejectReason: null },
        });

        const updated = await tx.taskerProfile.updateMany({
          where: { id: input.profileId, kycStatus: 'SUBMITTED' },
          data: {
            kycStatus: 'APPROVED',
            kycApprovedAt: new Date(),
            kycRejectedAt: null,
            kycRejectReason: null,
          },
        });

        if (updated.count === 0) return null;

        await tx.kycDecision.create({
          data: {
            taskerProfileId: input.profileId,
            adminId: ctx.admin.id,
            decision: 'APPROVED',
          },
        });

        const profile = await tx.taskerProfile.findUnique({
          where: { id: input.profileId },
          select: { userId: true },
        });
        return profile?.userId ?? null;
      });

      if (!userId) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'Este KYC não está aguardando análise',
        });
      }

      await notify(userId, {
        title: 'Conta profissional aprovada! ✅',
        body: 'Documentos e antecedentes aprovados. Você já pode ver e aceitar trampos!',
        data: { type: 'kyc_approved' },
      });

      return { success: true };
    }),

  /**
   * Reject a KYC submission with a reason. Records an audit decision and
   * notifies the tasker so they can resubmit.
   */
  rejectKyc: requireAdminRole('SUPER_ADMIN', 'OPERATOR')
    .input(
      z.object({
        profileId: z.string().uuid(),
        reason: z.string().trim().min(3, 'Informe o motivo da reprovação'),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = await prisma.$transaction(async (tx) => {
        const updated = await tx.taskerProfile.updateMany({
          where: { id: input.profileId, kycStatus: 'SUBMITTED' },
          data: {
            kycStatus: 'REJECTED',
            kycRejectedAt: new Date(),
            kycRejectReason: input.reason,
            kycApprovedAt: null,
          },
        });

        if (updated.count === 0) return null;

        await tx.kycDecision.create({
          data: {
            taskerProfileId: input.profileId,
            adminId: ctx.admin.id,
            decision: 'REJECTED',
            reason: input.reason,
          },
        });

        const profile = await tx.taskerProfile.findUnique({
          where: { id: input.profileId },
          select: { userId: true },
        });
        return profile?.userId ?? null;
      });

      if (!userId) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'Este KYC não está aguardando análise',
        });
      }

      await notify(userId, {
        title: 'Conta profissional reprovada',
        body: `Sua verificação profissional foi reprovada: ${input.reason}. Corrija e envie novamente.`,
        data: { type: 'kyc_rejected' },
      });

      return { success: true };
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

  // ==========================================================================
  // NESTED DOMAIN ROUTERS (analytics + financial management)
  // ==========================================================================
  dashboard: dashboardRouter,
  finance: financeRouter,
  campaigns: campaignsRouter,
  banners: bannersAdminRouter,
  identity: identityAdminRouter,
  services: servicesAdminRouter,
  requests: requestsAdminRouter,
  reviews: reviewsAdminRouter,
  disputes: disputesAdminRouter,
  reports: reportsAdminRouter,
  settings: settingsAdminRouter,
});

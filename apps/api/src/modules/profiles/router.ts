import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure } from '../../trpc';
import { registerProfileInput, updateProfileInput } from '@trampo/contracts';
import { prisma, Prisma } from '@trampo/db';
import { storeEncryptedCpf } from '../../lib/pii';
import { isAdminUser } from '../../lib/admin';
import crypto from 'crypto';

const isTaskerRole = (role: string) => role === 'TASKER' || role === 'BOTH';

export const profilesRouter = router({
  /**
   * Get current user profile
   */
  getMe: protectedProcedure.query(async ({ ctx }) => {
    const user = await prisma.user.findUnique({
      where: { id: ctx.user.id },
      include: {
        taskerProfile: {
          include: {
            categories: {
              include: { category: true },
            },
          },
        },
      },
    });

    if (!user) return null;

    // Never send PII hashes, the encrypted CPF blob or the device token back
    const { cpfHash, cpfEncrypted: _cpfEncrypted, pushToken: _pushToken, ...safeUser } = user;
    return { ...safeUser, hasCpf: !!cpfHash, isAdmin: isAdminUser(user.id) };
  }),

  /**
   * Update profile (name, email, role)
   */
  updateProfile: protectedProcedure
    .input(registerProfileInput)
    .mutation(async ({ ctx, input }) => {
      const { name, cpf, email, role } = input;

      // Hash CPF for lookups (never store plain CPF)
      const cpfHash = crypto.createHash('sha256').update(cpf).digest('hex');

      // CPF is set once: it backs KYC and payouts, so it can't be swapped later
      if (ctx.user.cpfHash && ctx.user.cpfHash !== cpfHash) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'O CPF não pode ser alterado. Fale com o suporte.',
        });
      }

      // Check if CPF already used by another user
      const existingCpf = await prisma.user.findFirst({
        where: {
          cpfHash,
          id: { not: ctx.user.id },
        },
        select: { id: true },
      });

      if (existingCpf) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'Não foi possível concluir o cadastro com este CPF. Fale com o suporte.',
        });
      }

      const existingProfile = await prisma.taskerProfile.findUnique({
        where: { userId: ctx.user.id },
        select: { id: true },
      });

      // Persist the profile, the encrypted CPF and the tasker profile atomically:
      // if CPF encryption fails we must not leave a half-written profile (which
      // would break payments later via getDecryptedCpf).
      const user = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        const updated = await tx.user.update({
          where: { id: ctx.user.id },
          data: { name, email, cpfHash, role },
        });

        // Encrypt CPF at rest with pgcrypto (stored in users.cpf_encrypted).
        // The plaintext CPF is never persisted — only the hash (for lookups)
        // and the encrypted blob (for KYC/verification).
        await storeEncryptedCpf(ctx.user.id, cpf, tx);

        // Create tasker profile if becoming tasker
        if (isTaskerRole(role) && !existingProfile) {
          await tx.taskerProfile.create({ data: { userId: ctx.user.id } });
        }

        return updated;
      });

      return { id: user.id, name: user.name, email: user.email, role: user.role };
    }),

  /**
   * Update basic profile fields (name, email). CPF is immutable.
   */
  updateBasicProfile: protectedProcedure
    .input(updateProfileInput)
    .mutation(async ({ ctx, input }) => {
      const user = await prisma.user.update({
        where: { id: ctx.user.id },
        data: {
          name: input.name,
          email: input.email ? input.email : null,
        },
      });

      return { id: user.id, name: user.name, email: user.email };
    }),

  /**
   * Public profile of any user (name, avatar, rating, stats) for profile pages.
   */
  getPublic: protectedProcedure
    .input(z.object({ userId: z.string().uuid() }))
    .query(async ({ input }) => {
      const user = await prisma.user.findUnique({
        where: { id: input.userId },
        select: {
          id: true,
          name: true,
          avatarUrl: true,
          createdAt: true,
          role: true,
          taskerProfile: {
            select: { rating: true, totalTasks: true, kycStatus: true, bio: true },
          },
        },
      });

      if (!user) {
        throw new TRPCError({ code: 'NOT_FOUND' });
      }

      return {
        id: user.id,
        name: user.name,
        avatarUrl: user.avatarUrl,
        memberSince: user.createdAt.toISOString(),
        isTasker: user.role === 'TASKER' || user.role === 'BOTH',
        rating: user.taskerProfile?.rating ?? 0,
        totalTasks: user.taskerProfile?.totalTasks ?? 0,
        kycVerified: user.taskerProfile?.kycStatus === 'APPROVED',
        bio: user.taskerProfile?.bio ?? null,
      };
    }),

  /**
   * Become a tasker: upgrade the role to also offer services and create the
   * tasker profile if missing. Idempotent. The user keeps their client role.
   */
  becomeTasker: protectedProcedure.mutation(async ({ ctx }) => {
    const profile = await prisma.taskerProfile.findUnique({
      where: { userId: ctx.user.id },
    });
    const alreadyTasker = isTaskerRole(ctx.user.role);

    if (alreadyTasker && profile) {
      return { success: true, alreadyTasker: true };
    }

    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      if (!alreadyTasker) {
        await tx.user.update({
          where: { id: ctx.user.id },
          data: { role: 'BOTH' }, // keeps the client role
        });
      }
      if (!profile) {
        await tx.taskerProfile.create({ data: { userId: ctx.user.id } });
      }
    });

    return { success: true, alreadyTasker: false };
  }),

  /**
   * Update tasker categories
   */
  updateCategories: protectedProcedure
    .input(z.object({ categoryIds: z.array(z.string().uuid()).min(1).max(20) }))
    .mutation(async ({ ctx, input }) => {
      const { categoryIds } = input;

      // Get tasker profile
      const profile = await prisma.taskerProfile.findUnique({
        where: { userId: ctx.user.id },
      });

      if (!profile) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Perfil de profissional não encontrado' });
      }

      // Delete existing and create new
      await prisma.$transaction([
        prisma.taskerProfileCategory.deleteMany({
          where: { taskerProfileId: profile.id },
        }),
        prisma.taskerProfileCategory.createMany({
          data: categoryIds.map((categoryId) => ({
            taskerProfileId: profile.id,
            categoryId,
          })),
          skipDuplicates: true,
        }),
      ]);

      return { success: true };
    }),

  /**
   * Update tasker service radius
   */
  updateRadius: protectedProcedure
    .input(z.object({ radiusMeters: z.number().int().min(1000).max(50000) }))
    .mutation(async ({ ctx, input }) => {
      await prisma.taskerProfile.update({
        where: { userId: ctx.user.id },
        data: { serviceRadius: input.radiusMeters },
      });

      return { success: true };
    }),

  /**
   * Register push notification token
   */
  registerPushToken: protectedProcedure
    .input(z.object({ token: z.string().regex(/^Expo(nent)?PushToken\[[^\]]{10,200}\]$/) }))
    .mutation(async ({ ctx, input }) => {
      await prisma.user.update({
        where: { id: ctx.user.id },
        data: { pushToken: input.token },
      });

      console.log(`[PUSH] Registered token for user ${ctx.user.id}`);
      return { success: true };
    }),

  /**
   * Unregister push notification token (logout)
   */
  unregisterPushToken: protectedProcedure.mutation(async ({ ctx }) => {
    await prisma.user.update({
      where: { id: ctx.user.id },
      data: { pushToken: null },
    });

    return { success: true };
  }),
});

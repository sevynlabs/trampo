import { z } from 'zod';
import { router, protectedProcedure } from '../../trpc';
import { registerProfileInput } from '@trampo/contracts';
import { prisma } from '@trampo/db';
import { storeEncryptedCpf } from '../../lib/pii';
import { env } from '../../lib/env';
import crypto from 'crypto';

const adminIds = new Set(
  env.ADMIN_USER_IDS.split(',')
    .map((id) => id.trim())
    .filter(Boolean)
);

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

    return { ...user, isAdmin: adminIds.has(user.id) };
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

      // Check if CPF already used by another user
      const existingCpf = await prisma.user.findFirst({
        where: {
          cpfHash,
          id: { not: ctx.user.id },
        },
      });

      if (existingCpf) {
        throw new Error('CPF já cadastrado');
      }

      const user = await prisma.user.update({
        where: { id: ctx.user.id },
        data: {
          name,
          email,
          cpfHash,
          role,
        },
      });

      // Encrypt CPF at rest with pgcrypto (stored in users.cpf_encrypted).
      // The plaintext CPF is never persisted — only the hash (for lookups)
      // and the encrypted blob (for KYC/verification).
      await storeEncryptedCpf(ctx.user.id, cpf);

      // Create tasker profile if becoming tasker
      if ((role === 'TASKER' || role === 'BOTH') && !user.role.includes('TASKER')) {
        await prisma.taskerProfile.create({
          data: { userId: ctx.user.id },
        });
      }

      return user;
    }),

  /**
   * Update tasker categories
   */
  updateCategories: protectedProcedure
    .input(z.object({ categoryIds: z.array(z.string().uuid()) }))
    .mutation(async ({ ctx, input }) => {
      const { categoryIds } = input;

      // Get tasker profile
      const profile = await prisma.taskerProfile.findUnique({
        where: { userId: ctx.user.id },
      });

      if (!profile) {
        throw new Error('Tasker profile not found');
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
    .input(z.object({ token: z.string().min(1) }))
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

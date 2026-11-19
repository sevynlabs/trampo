import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure, withRateLimit } from '../../trpc';
import { registerProfileInput, updateProfileInput } from '@trampo/contracts';
import { prisma, Prisma } from '@trampo/db';
import { storeEncryptedCpf } from '../../lib/pii';
import { isAdminUser } from '../../lib/admin';
import crypto from 'crypto';
import { AVATAR_BUCKET, ensureAvatarBucket, avatarPublicUrl, removeOldAvatars } from '../../lib/avatars';
import { supabase } from '../../lib/supabase';
import { deleteAccount, getDeletionBlockers } from '../../lib/account-deletion';

const isTaskerRole = (role: string) => role === 'TASKER' || role === 'BOTH';

// Public in-app ID helpers live in lib/public-code (shared with the admin API)
export { formatPublicCode, parsePublicCode } from '../../lib/public-code';
import { formatPublicCode, parsePublicCode } from '../../lib/public-code';

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

    const identity = await prisma.identityVerification.findUnique({
      where: { userId: user.id },
      select: { status: true, rejectReason: true },
    });

    // Never send PII hashes, the encrypted CPF blob or the device token back
    const { cpfHash, cpfEncrypted: _cpfEncrypted, pushToken: _pushToken, ...safeUser } = user;
    return {
      ...safeUser,
      /** Minimum verification (every user). SUBMITTED is enough to post/hire. */
      identityStatus: identity?.status ?? 'PENDING',
      identityRejectReason: identity?.rejectReason ?? null,
      publicCode: formatPublicCode(user.publicCode),
      hasCpf: !!cpfHash,
      isAdmin: isAdminUser(user.id),
    };
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
   * Profile photo, step 1: signed upload URL for the public "avatars" bucket.
   */
  getAvatarUploadUrl: protectedProcedure
    .use(withRateLimit(10, 60))
    .input(z.object({ contentType: z.enum(['image/jpeg', 'image/png', 'image/webp']) }))
    .mutation(async ({ ctx, input }) => {
      await ensureAvatarBucket();
      const ext = input.contentType === 'image/png' ? 'png' : input.contentType === 'image/webp' ? 'webp' : 'jpg';
      const path = `${ctx.user.id}/avatar_${Date.now()}.${ext}`;
      const { data, error } = await supabase.storage.from(AVATAR_BUCKET).createSignedUploadUrl(path);
      if (error || !data) {
        console.error('[AVATAR] Upload URL error:', error);
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Não foi possível preparar o envio da foto' });
      }
      return { uploadUrl: data.signedUrl, path };
    }),

  /**
   * Profile photo, step 2: the app uploaded the file; save its public URL.
   */
  confirmAvatar: protectedProcedure
    .input(z.object({ path: z.string().max(200) }))
    .mutation(async ({ ctx, input }) => {
      const expected = new RegExp(`^${ctx.user.id}/avatar_[0-9]+[.](jpg|png|webp)$`);
      if (!expected.test(input.path)) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Caminho de foto inválido' });
      }
      // The file must really be there (the signed URL may have been unused).
      const name = input.path.split('/')[1];
      const { data: files } = await supabase.storage.from(AVATAR_BUCKET).list(ctx.user.id, { search: name });
      if (!files?.some((f) => f.name === name)) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'A foto não chegou. Tente de novo.' });
      }
      const avatarUrl = avatarPublicUrl(input.path);
      await prisma.user.update({ where: { id: ctx.user.id }, data: { avatarUrl } });
      await removeOldAvatars(ctx.user.id, input.path).catch((e) => console.warn('[AVATAR] cleanup', e));
      return { avatarUrl };
    }),

  /**
   * Remove the profile photo.
   */
  removeAvatar: protectedProcedure.mutation(async ({ ctx }) => {
    await prisma.user.update({ where: { id: ctx.user.id }, data: { avatarUrl: null } });
    await removeOldAvatars(ctx.user.id).catch((e) => console.warn('[AVATAR] cleanup', e));
    return { ok: true };
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
          publicCode: true,
          taskerProfile: {
            select: {
              rating: true,
              totalTasks: true,
              kycStatus: true,
              bio: true,
              categories: { select: { category: { select: { id: true, name: true, slug: true } } } },
            },
          },
          _count: { select: { reviewsReceived: { where: { hiddenAt: null } } } },
        },
      });

      if (!user) {
        throw new TRPCError({ code: 'NOT_FOUND' });
      }

      return {
        id: user.id,
        name: user.name,
        avatarUrl: user.avatarUrl,
        publicCode: formatPublicCode(user.publicCode),
        memberSince: user.createdAt.toISOString(),
        isTasker: user.role === 'TASKER' || user.role === 'BOTH',
        rating: user.taskerProfile?.rating ?? 0,
        totalTasks: user.taskerProfile?.totalTasks ?? 0,
        kycVerified: user.taskerProfile?.kycStatus === 'APPROVED',
        bio: user.taskerProfile?.bio ?? null,
        reviewCount: user._count.reviewsReceived,
        categories: user.taskerProfile?.categories.map((c) => c.category) ?? [],
      };
    }),

  /**
   * Resolve a public in-app code ("TR-4F9A2C", typed from a shared profile
   * card) to the user id, so the app can open that profile.
   */
  findByCode: protectedProcedure
    .input(z.object({ code: z.string().trim().max(16) }))
    .query(async ({ input }) => {
      const code = parsePublicCode(input.code);
      if (!code) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Código inválido' });
      const user = await prisma.user.findUnique({ where: { publicCode: code }, select: { id: true, isActive: true } });
      if (!user || !user.isActive) throw new TRPCError({ code: 'NOT_FOUND', message: 'Nenhum perfil com esse código' });
      return { userId: user.id };
    }),

  /**
   * Directory of verified professionals (KYC approved) for the client's home
   * and search screens. Optional category and free-text filters.
   */
  listTaskers: protectedProcedure
    .input(
      z.object({
        categoryId: z.string().uuid().optional(),
        query: z.string().trim().max(80).optional(),
        sort: z.enum(['rating', 'experience', 'recent']).default('rating'),
        limit: z.number().int().min(1).max(50).default(20),
      })
    )
    .query(async ({ ctx, input }) => {
      const q = input.query || undefined;
      const code = q ? parsePublicCode(q) : null;
      const profiles = await prisma.taskerProfile.findMany({
        where: {
          kycStatus: 'APPROVED',
          userId: { not: ctx.user.id },
          user: { isActive: true },
          ...(input.categoryId ? { categories: { some: { categoryId: input.categoryId } } } : {}),
          ...(q
            ? {
                OR: [
                  ...(code ? [{ user: { publicCode: code } }] : []),
                  { user: { name: { contains: q, mode: 'insensitive' as const } } },
                  { bio: { contains: q, mode: 'insensitive' as const } },
                  { categories: { some: { category: { name: { contains: q, mode: 'insensitive' as const } } } } },
                ],
              }
            : {}),
        },
        orderBy:
          input.sort === 'experience'
            ? { totalTasks: 'desc' }
            : input.sort === 'recent'
              ? { createdAt: 'desc' }
              : [{ rating: 'desc' }, { totalTasks: 'desc' }],
        take: input.limit,
        select: {
          rating: true,
          totalTasks: true,
          bio: true,
          user: { select: { id: true, name: true, avatarUrl: true, _count: { select: { reviewsReceived: { where: { hiddenAt: null } } } } } },
          categories: { select: { category: { select: { id: true, name: true, slug: true } } } },
        },
      });

      return profiles.map((p) => ({
        id: p.user.id,
        name: p.user.name,
        avatarUrl: p.user.avatarUrl,
        rating: p.rating,
        totalTasks: p.totalTasks,
        reviewCount: p.user._count.reviewsReceived,
        bio: p.bio,
        categories: p.categories.map((c) => c.category),
      }));
    }),

  /**
   * Become a tasker: upgrade the role to also offer services and create the
   * tasker profile if missing. Idempotent. The user keeps their client role.
   */
  /**
   * What would block deleting the account right now (shown before confirming).
   */
  deletionCheck: protectedProcedure.query(async ({ ctx }) => {
    const blockers = await getDeletionBlockers(ctx.user.id);
    return { canDelete: blockers.length === 0, blockers };
  }),

  /**
   * Permanently delete the account (store requirement). Personal data and
   * documents are erased; financial records stay, anonymized.
   */
  deleteAccount: protectedProcedure
    .input(z.object({ confirm: z.literal('EXCLUIR') }))
    .mutation(async ({ ctx }) => {
      await deleteAccount(ctx.user.id);
      return { success: true };
    }),

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
   * Update tasker service area: radius and, optionally, the base location
   * (GPS) with its reverse-geocoded city/UF (shown and searchable in the admin).
   */
  updateRadius: protectedProcedure
    .input(
      z.object({
        radiusMeters: z.number().int().min(1000).max(50000),
        location: z
          .object({ latitude: z.number().min(-90).max(90), longitude: z.number().min(-180).max(180) })
          .optional(),
        city: z.string().trim().min(1).max(80).optional(),
        state: z
          .string()
          .trim()
          .regex(/^[A-Za-z]{2}$/, 'UF inválida')
          .transform((s) => s.toUpperCase())
          .optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const profile = await prisma.taskerProfile.update({
        where: { userId: ctx.user.id },
        data: {
          serviceRadius: input.radiusMeters,
          ...(input.city !== undefined ? { city: input.city } : {}),
          ...(input.state !== undefined ? { state: input.state } : {}),
        },
        select: { id: true },
      });

      if (input.location) {
        const { latitude, longitude } = input.location;
        await prisma.$executeRaw`
          UPDATE tasker_profiles
          SET current_location = ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)::geography
          WHERE id = ${profile.id}::uuid
        `;
      }

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

import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, publicProcedure, withRateLimit } from '../../trpc';
import { requestOtpInput, verifyOtpInput } from '@trampo/contracts';
import { prisma } from '@trampo/db';
import { sendOtp, verifyOtp } from '../../integrations/twilio';
import { generateTokenPair, verifyToken } from '../../lib/jwt';
import { env } from '../../lib/env';
import { redis } from '../../lib/redis';

// Development bypass code - requires BOTH NODE_ENV=development AND DEV_OTP_ENABLED=true
const DEV_OTP_CODE = '123456';
const isDevOtpEnabled = env.NODE_ENV === 'development' && env.DEV_OTP_ENABLED;

// Token blocklist prefix for Redis
const TOKEN_BLOCKLIST_PREFIX = 'token:blocked:';

export const authRouter = router({
  /**
   * Request OTP code via SMS
   * Rate limited: 5 requests per minute per phone
   */
  requestOtp: publicProcedure
    .use(withRateLimit(5, 60))
    .input(requestOtpInput)
    .mutation(async ({ input }) => {
      const { phone } = input;

      // In development with DEV_OTP_ENABLED=true, skip Twilio
      if (isDevOtpEnabled) {
        console.warn(`[AUTH] ⚠️ DEV MODE - OTP bypass enabled. Code: ${DEV_OTP_CODE}`);
        return { success: true, message: 'OTP sent' };
      }

      // Send OTP via Twilio
      const result = await sendOtp(phone);

      if (!result.success) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: result.error || 'Failed to send OTP',
        });
      }

      return { success: true, message: 'OTP sent' };
    }),

  /**
   * Verify OTP and create/login user
   */
  verifyOtp: publicProcedure
    .use(withRateLimit(10, 60))
    .input(verifyOtpInput)
    .mutation(async ({ input }) => {
      const { phone, code } = input;

      // Verify OTP
      if (isDevOtpEnabled) {
        // Accept dev code ONLY when explicitly enabled
        if (code !== DEV_OTP_CODE) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Invalid OTP code',
          });
        }
        console.warn(`[AUTH] ⚠️ DEV MODE - OTP bypass accepted for ${phone}`);
      } else {
        // Verify with Twilio in production
        const result = await verifyOtp(phone, code);

        if (!result.success) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: result.error || 'Invalid OTP code',
          });
        }
      }

      // Find or create user
      let user = await prisma.user.findUnique({
        where: { phone },
      });

      const isNewUser = !user;

      if (!user) {
        user = await prisma.user.create({
          data: { phone },
        });
        console.log(`[AUTH] New user created: ${user.id}`);
      } else {
        console.log(`[AUTH] Existing user logged in: ${user.id}`);
      }

      // Generate JWT tokens
      const { accessToken, refreshToken } = await generateTokenPair({
        id: user.id,
        phone: user.phone,
        role: user.role,
      });

      // Get KYC status if tasker
      let kycStatus = null;
      if (user.role === 'TASKER' || user.role === 'BOTH') {
        const profile = await prisma.taskerProfile.findUnique({
          where: { userId: user.id },
        });
        kycStatus = profile?.kycStatus ?? 'PENDING';
      }

      return {
        accessToken,
        refreshToken,
        isNewUser,
        user: {
          id: user.id,
          phone: user.phone,
          name: user.name,
          role: user.role,
          kycStatus,
        },
      };
    }),

  /**
   * Refresh access token
   */
  refresh: publicProcedure
    .use(withRateLimit(20, 60)) // 20 refreshes per minute
    .input(z.object({ refreshToken: z.string() }))
    .mutation(async ({ input }) => {
      const { refreshToken } = input;

      // Check if token is blocklisted (user logged out)
      const isBlocked = await redis.get(`${TOKEN_BLOCKLIST_PREFIX}${refreshToken}`);
      if (isBlocked) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Token has been revoked',
        });
      }

      // Verify refresh token
      const payload = await verifyToken(refreshToken);

      if (!payload) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Invalid or expired refresh token',
        });
      }

      // Must be a refresh token
      if (payload.type !== 'refresh') {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Invalid token type',
        });
      }

      // Verify user still exists
      const user = await prisma.user.findUnique({
        where: { id: payload.sub },
      });

      if (!user) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'User not found',
        });
      }

      // Generate new token pair
      const tokens = await generateTokenPair({
        id: user.id,
        phone: user.phone,
        role: user.role,
      });

      console.log(`[AUTH] Tokens refreshed for user: ${user.id}`);

      return tokens;
    }),

  /**
   * Logout - invalidate refresh token by adding to blocklist
   * Token is blocked for 30 days (refresh token lifetime)
   */
  logout: publicProcedure
    .input(z.object({ refreshToken: z.string().optional() }))
    .mutation(async ({ input }) => {
      const { refreshToken } = input;

      if (refreshToken) {
        // Block the refresh token for 30 days (its max lifetime)
        const THIRTY_DAYS_IN_SECONDS = 30 * 24 * 60 * 60;
        await redis.set(
          `${TOKEN_BLOCKLIST_PREFIX}${refreshToken}`,
          '1',
          'EX',
          THIRTY_DAYS_IN_SECONDS
        );
        console.log('[AUTH] Refresh token added to blocklist');
      }

      return { success: true };
    }),
});

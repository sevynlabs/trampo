import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, publicProcedure, withRateLimit } from '../../trpc';
import { requestOtpInput, verifyOtpInput } from '@trampo/contracts';
import { prisma } from '@trampo/db';
import { sendOtp, verifyOtp } from '../../integrations/twilio';
import { generateTokenPair, verifyToken } from '../../lib/jwt';
import { env } from '../../lib/env';

// Development bypass code
const DEV_OTP_CODE = '123456';

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

      // In development, skip Twilio
      if (env.NODE_ENV === 'development') {
        console.log(`[AUTH] Development mode - OTP code: ${DEV_OTP_CODE}`);
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
      if (env.NODE_ENV === 'development') {
        // Accept dev code in development
        if (code !== DEV_OTP_CODE) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Invalid OTP code',
          });
        }
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
    .input(z.object({ refreshToken: z.string() }))
    .mutation(async ({ input }) => {
      const { refreshToken } = input;

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
   * Logout - invalidate refresh token (client-side)
   * In a more robust implementation, you'd store refresh tokens in DB
   * and mark them as revoked here
   */
  logout: publicProcedure.mutation(async () => {
    // Currently stateless - client just deletes tokens
    // Future: Add token to blocklist in Redis
    return { success: true };
  }),
});

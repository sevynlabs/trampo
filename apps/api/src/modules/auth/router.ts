import { z } from 'zod';
import { router, publicProcedure, withRateLimit } from '../../trpc';
import { requestOtpInput, verifyOtpInput } from '@trampo/contracts';
import { prisma } from '@trampo/db';

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

      // TODO: Integrate with Twilio Verify
      // For now, just log and return success
      console.log(`[AUTH] OTP requested for ${phone}`);

      // In development, use a fixed code
      if (process.env.NODE_ENV === 'development') {
        console.log(`[AUTH] Development OTP code: 123456`);
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

      // TODO: Verify with Twilio
      // For now, accept 123456 in development
      if (process.env.NODE_ENV === 'development' && code !== '123456') {
        throw new Error('Invalid OTP code');
      }

      // Find or create user
      let user = await prisma.user.findUnique({
        where: { phone },
      });

      if (!user) {
        user = await prisma.user.create({
          data: { phone },
        });
      }

      // TODO: Generate real JWT with Supabase
      const accessToken = `dev-token-${user.id}`;
      const refreshToken = `dev-refresh-${user.id}`;

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
      // TODO: Implement token refresh
      const { refreshToken } = input;

      // Extract user ID from refresh token (dev mode)
      const userId = refreshToken.replace('dev-refresh-', '');

      const user = await prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        throw new Error('Invalid refresh token');
      }

      return {
        accessToken: `dev-token-${user.id}`,
        refreshToken: `dev-refresh-${user.id}`,
      };
    }),
});

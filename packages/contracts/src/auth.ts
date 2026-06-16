import { z } from 'zod';
import { phoneSchema, cpfSchema } from './common';

// ============================================
// Auth schemas
// ============================================

export const requestOtpInput = z.object({
  phone: phoneSchema,
});

export const verifyOtpInput = z.object({
  phone: phoneSchema,
  code: z.string().length(6, 'OTP must be 6 digits'),
});

export const sessionOutput = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  user: z.object({
    id: z.string().uuid(),
    phone: z.string(),
    name: z.string().nullable(),
    role: z.enum(['CLIENT', 'TASKER', 'BOTH']),
    kycStatus: z.enum(['PENDING', 'SUBMITTED', 'APPROVED', 'REJECTED']).nullable(),
  }),
});

export const registerProfileInput = z.object({
  name: z.string().min(2).max(100),
  cpf: cpfSchema,
  email: z.string().email().optional(),
  role: z.enum(['CLIENT', 'TASKER', 'BOTH']),
});

export type RequestOtpInput = z.infer<typeof requestOtpInput>;
export type VerifyOtpInput = z.infer<typeof verifyOtpInput>;
export type SessionOutput = z.infer<typeof sessionOutput>;
export type RegisterProfileInput = z.infer<typeof registerProfileInput>;

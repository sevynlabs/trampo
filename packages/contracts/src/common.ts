import { z } from 'zod';

// ============================================
// Common schemas used across the app
// ============================================

export const uuidSchema = z.string().uuid();

export const phoneSchema = z
  .string()
  .regex(/^\+55\d{10,11}$/, 'Invalid Brazilian phone number')
  .transform((val) => val.replace(/\D/g, ''));

export const cpfSchema = z
  .string()
  .regex(/^\d{11}$/, 'CPF must have 11 digits')
  .refine((cpf) => {
    // CPF validation algorithm
    if (cpf.length !== 11 || /^(\d)\1+$/.test(cpf)) return false;

    let sum = 0;
    for (let i = 0; i < 9; i++) {
      sum += parseInt(cpf.charAt(i)) * (10 - i);
    }
    let remainder = (sum * 10) % 11;
    if (remainder === 10 || remainder === 11) remainder = 0;
    if (remainder !== parseInt(cpf.charAt(9))) return false;

    sum = 0;
    for (let i = 0; i < 10; i++) {
      sum += parseInt(cpf.charAt(i)) * (11 - i);
    }
    remainder = (sum * 10) % 11;
    if (remainder === 10 || remainder === 11) remainder = 0;
    return remainder === parseInt(cpf.charAt(10));
  }, 'Invalid CPF');

export const coordinatesSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

export type Coordinates = z.infer<typeof coordinatesSchema>;

// Pagination
export const paginationSchema = z.object({
  limit: z.number().int().min(1).max(100).default(20),
  offset: z.number().int().min(0).default(0),
});

export type Pagination = z.infer<typeof paginationSchema>;

// User roles
export const userRoleSchema = z.enum(['CLIENT', 'TASKER', 'BOTH']);
export type UserRole = z.infer<typeof userRoleSchema>;

// KYC status
export const kycStatusSchema = z.enum(['PENDING', 'SUBMITTED', 'APPROVED', 'REJECTED']);
export type KycStatus = z.infer<typeof kycStatusSchema>;

// Task status
export const taskStatusSchema = z.enum([
  'OPEN',
  'ACCEPTED',
  'IN_PROGRESS',
  'COMPLETED',
  'RELEASED',
  'CANCELLED',
  'DISPUTED',
]);
export type TaskStatus = z.infer<typeof taskStatusSchema>;

// Payment status
export const paymentStatusSchema = z.enum([
  'PENDING',
  'CONFIRMED',
  'HELD',
  'RELEASED',
  'REFUNDED',
  'DISPUTED',
]);
export type PaymentStatus = z.infer<typeof paymentStatusSchema>;

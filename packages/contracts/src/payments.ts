import { z } from 'zod';
import { uuidSchema, paymentStatusSchema } from './common';

// ============================================
// Payment schemas
// ============================================

export const createPaymentInput = z.object({
  taskId: uuidSchema,
});

export const paymentOutput = z.object({
  id: uuidSchema,
  taskId: uuidSchema,
  asaasPaymentId: z.string().nullable(),
  pixCode: z.string().nullable(),
  pixQrCode: z.string().nullable(), // Base64 QR code image
  amount: z.number().int(),
  platformFee: z.number().int(),
  taskerAmount: z.number().int(),
  status: paymentStatusSchema,
  paidAt: z.string().datetime().nullable(),
  heldAt: z.string().datetime().nullable(),
  releasedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
});

export const paymentStatusOutput = z.object({
  status: paymentStatusSchema,
  paidAt: z.string().datetime().nullable(),
});

// Asaas webhook event types
export const asaasWebhookEvent = z.object({
  event: z.string(),
  payment: z.object({
    id: z.string(),
    customer: z.string(),
    value: z.number(),
    status: z.string(),
    billingType: z.string(),
    externalReference: z.string().optional(),
  }),
});

export type CreatePaymentInput = z.infer<typeof createPaymentInput>;
export type PaymentOutput = z.infer<typeof paymentOutput>;
export type PaymentStatusOutput = z.infer<typeof paymentStatusOutput>;
export type AsaasWebhookEvent = z.infer<typeof asaasWebhookEvent>;

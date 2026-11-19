import { z } from 'zod';
import { uuidSchema, coordinatesSchema, taskStatusSchema, paginationSchema } from './common';

// ============================================
// Task schemas
// ============================================

// Business constants (in centavos)
export const TASK_CONSTANTS = {
  /** Default minimum (R$ 50). The live minimum comes from the admin settings (config.public). */
  MIN_VALUE: 5000, // R$ 50.00
  /** Hard floor accepted by the API schema; the settings minimum must be ≥ this. */
  ABSOLUTE_MIN_VALUE: 1000, // R$ 10.00
  MAX_VALUE: 10_000_000, // R$ 100.000,00 (keeps fees well inside int4)
  TASKER_FEE: 0.15, // 15%
  CLIENT_FEE: 0.05, // 5%
  URGENCY_FEE: 0.30, // +30%
  CANCEL_PENALTY: 0.20, // 20%
  ESCROW_RELEASE_HOURS: 1,
  FREE_CANCEL_MINUTES: 30,
} as const;

export const createTaskInput = z.object({
  categoryId: uuidSchema,
  title: z.string().min(5).max(200),
  description: z.string().max(1000).optional(),
  address: z.string().min(5).max(300),
  location: coordinatesSchema,
  scheduledAt: z.string().datetime().optional(), // ISO string
  isUrgent: z.boolean().default(false),
  baseValue: z
    .number()
    .int()
    .min(TASK_CONSTANTS.ABSOLUTE_MIN_VALUE, `Minimum value is R$ ${TASK_CONSTANTS.ABSOLUTE_MIN_VALUE / 100}`)
    .max(TASK_CONSTANTS.MAX_VALUE),
});

export const taskOutput = z.object({
  id: uuidSchema,
  categoryId: uuidSchema,
  categoryName: z.string(),
  categoryIcon: z.string().nullable(),
  clientId: uuidSchema,
  clientName: z.string(),
  clientRating: z.number(),
  title: z.string(),
  description: z.string().nullable(),
  address: z.string(),
  location: coordinatesSchema,
  scheduledAt: z.string().datetime().nullable(),
  isUrgent: z.boolean(),
  baseValue: z.number().int(),
  urgencyFee: z.number().int(),
  serviceFee: z.number().int(),
  totalValue: z.number().int(), // What client pays
  taskerValue: z.number().int(), // What tasker receives
  status: taskStatusSchema,
  distance: z.number().optional(), // In meters, for feed
  createdAt: z.string().datetime(),
});

export const feedInput = z.object({
  location: coordinatesSchema,
  radiusMeters: z.number().int().min(1000).max(50000).default(10000),
  categoryId: uuidSchema.optional(),
  ...paginationSchema.shape,
});

export const acceptTaskInput = z.object({
  taskId: uuidSchema,
});

export const updateTaskStatusInput = z.object({
  taskId: uuidSchema,
  status: z.enum(['IN_PROGRESS', 'COMPLETED']),
});

export const cancelTaskInput = z.object({
  taskId: uuidSchema,
  reason: z.string().max(500).optional(),
});

export type CreateTaskInput = z.infer<typeof createTaskInput>;
export type TaskOutput = z.infer<typeof taskOutput>;
export type FeedInput = z.infer<typeof feedInput>;
export type AcceptTaskInput = z.infer<typeof acceptTaskInput>;
export type UpdateTaskStatusInput = z.infer<typeof updateTaskStatusInput>;
export type CancelTaskInput = z.infer<typeof cancelTaskInput>;

import { z } from 'zod';
import { uuidSchema, paginationSchema } from './common';

// ============================================
// Review schemas
// ============================================

export const reviewTagSchema = z.enum([
  'Pontual',
  'Caprichoso',
  'Comunicativo',
  'Recomendo',
  'Profissional',
  'Atencioso',
  'Rapido',
  'Educado',
]);

export const submitReviewInput = z.object({
  taskId: uuidSchema,
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(500).optional(),
  tags: z.array(reviewTagSchema).max(4).optional(),
});

export const reviewOutput = z.object({
  id: uuidSchema,
  taskId: uuidSchema,
  reviewerId: uuidSchema,
  reviewerName: z.string(),
  revieweeId: uuidSchema,
  rating: z.number().int(),
  comment: z.string().nullable(),
  tags: z.array(z.string()),
  createdAt: z.string().datetime(),
});

export const listReviewsInput = z.object({
  userId: uuidSchema,
  ...paginationSchema.shape,
});

export type SubmitReviewInput = z.infer<typeof submitReviewInput>;
export type ReviewOutput = z.infer<typeof reviewOutput>;
export type ListReviewsInput = z.infer<typeof listReviewsInput>;

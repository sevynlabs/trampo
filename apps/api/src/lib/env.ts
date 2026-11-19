import { z } from 'zod';

/**
 * Environment variables schema
 * Validates all required env vars at startup
 * Fails fast if any are missing
 */
const envSchema = z.object({
  // Node
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  API_PORT: z.string().default('3000'),

  // Database
  DATABASE_URL: z.string().url(),
  DIRECT_URL: z.string().url().optional(),

  // Supabase
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),

  // Asaas
  ASAAS_API_KEY: z.string().min(1),
  ASAAS_WEBHOOK_TOKEN: z.string().min(1),
  ASAAS_ENVIRONMENT: z.enum(['sandbox', 'production']).default('sandbox'),

  // Twilio (optional in development - uses mock OTP)
  TWILIO_ACCOUNT_SID: z.string().startsWith('AC').optional(),
  TWILIO_AUTH_TOKEN: z.string().min(1).optional(),
  TWILIO_VERIFY_SERVICE_SID: z.string().startsWith('VA').optional(),

  // Development OTP bypass - MUST be explicitly enabled, never on by default
  // Set to "true" ONLY in local development environment
  DEV_OTP_ENABLED: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),

  // App Store / Google Play reviewer login. Only this exact number accepts this
  // fixed code (no SMS is sent). Leave both unset to disable. Works in production.
  REVIEW_PHONE: z
    .string()
    .regex(/^\+55\d{10,11}$/)
    .optional(),
  REVIEW_OTP_CODE: z
    .string()
    .regex(/^\d{6}$/)
    .optional(),

  // Super admin of the panel, managed only here (no API route / panel screen).
  // Change these and redeploy to update e-mail/password. Both or neither.
  SUPER_ADMIN_EMAIL: z.string().email().optional(),
  SUPER_ADMIN_PASSWORD: z.string().min(12, 'SUPER_ADMIN_PASSWORD precisa de 12+ caracteres').optional(),
  SUPER_ADMIN_NAME: z.string().max(80).optional(),

  // Redis
  UPSTASH_REDIS_REST_URL: z.string().url(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1),

  // Encryption
  PII_ENCRYPTION_KEY: z.string().length(32),

  // JWT
  JWT_SECRET: z.string().min(32),

  // Admin allowlist (comma-separated user UUIDs) for dispute resolution / backoffice
  ADMIN_USER_IDS: z.string().default(''),

  // Optional
  FCM_SERVER_KEY: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  RESEND_FROM: z.string().optional(),
  CORS_ORIGIN: z.string().default('*'),
});

// Parse and validate
const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:');
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;

// Type export
export type Env = z.infer<typeof envSchema>;

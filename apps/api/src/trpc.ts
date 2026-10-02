import { initTRPC, TRPCError } from '@trpc/server';
import type { Context as HonoContext } from 'hono';
import superjson from 'superjson';
import { prisma, type User, type AdminUser } from '@trampo/db';
import { checkRateLimit } from './lib/redis';
import { verifyToken } from './lib/jwt';
import { verifyAdminToken } from './lib/admin-jwt';
import { isAdminUser } from './lib/admin';

/**
 * Context passed to every tRPC procedure
 */
export interface Context {
  req: Request;
  honoContext: HonoContext;
  user: User | null;
  admin: AdminUser | null;
  [key: string]: unknown;
}

/**
 * Create context for each request
 */
export async function createContext(honoContext: HonoContext): Promise<Context> {
  const req = honoContext.req.raw;

  // Extract JWT from Authorization header
  const authHeader = honoContext.req.header('Authorization');
  let user: User | null = null;
  let admin: AdminUser | null = null;

  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);

    try {
      // Verify JWT signature and expiration
      const payload = await verifyToken(token);

      if (payload && payload.type === 'access') {
        // Fetch user from database to ensure they still exist
        user = await prisma.user.findUnique({
          where: { id: payload.sub },
        });

        // Blocked users lose access immediately, even with a valid token
        if (user && !user.isActive) {
          user = null;
        }

        // Verify role hasn't changed (token might have stale role)
        if (user && user.role !== payload.role) {
          console.log(`[AUTH] Role mismatch - token: ${payload.role}, db: ${user.role}`);
          // Still allow access, user object has current role
        }
      }
    } catch {
      // Invalid token, user remains null
    }

    // Admin panel tokens use a separate audience, so this only matches
    // genuine admin JWTs (never a mobile user token).
    if (!user) {
      const adminPayload = await verifyAdminToken(token);
      if (adminPayload) {
        const found = await prisma.adminUser.findUnique({
          where: { id: adminPayload.sub },
        });
        // Reject deactivated admins immediately.
        admin = found && found.isActive ? found : null;
      }
    }
  }

  return {
    req,
    honoContext,
    user,
    admin,
  };
}

/**
 * Initialize tRPC
 */
const t = initTRPC.context<Context>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        // Don't expose internal errors in production
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      },
    };
  },
});

export const router = t.router;
export const publicProcedure = t.procedure;

/**
 * Middleware: Require authenticated user
 */
const isAuthenticated = t.middleware(async ({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'You must be logged in to access this resource',
    });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user, // Now guaranteed to be non-null
    },
  });
});

export const protectedProcedure = t.procedure.use(isAuthenticated);

/**
 * Middleware: Require KYC-approved tasker
 */
const isApprovedTasker = t.middleware(async ({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }

  const profile = await prisma.taskerProfile.findUnique({
    where: { userId: ctx.user.id },
  });

  if (!profile || profile.kycStatus !== 'APPROVED') {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'KYC approval required to perform this action',
    });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
      taskerProfile: profile,
    },
  });
});

export const taskerProcedure = t.procedure.use(isApprovedTasker);

/**
 * Middleware: Require admin user (allowlisted via ADMIN_USER_IDS)
 */
const isAdmin = t.middleware(async ({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }

  if (!isAdminUser(ctx.user.id)) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Admin access required',
    });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

export const adminProcedure = t.procedure.use(isAdmin);

/**
 * Middleware: Require an authenticated admin-panel user (AdminUser + admin JWT).
 *
 * This is distinct from `adminProcedure` above, which gates mobile users via
 * the ADMIN_USER_IDS allowlist. The admin panel authenticates against the
 * AdminUser table with its own email/password + JWT.
 */
const isAdminAuthenticated = t.middleware(async ({ ctx, next }) => {
  if (!ctx.admin) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'Admin authentication required',
    });
  }

  return next({
    ctx: {
      ...ctx,
      admin: ctx.admin, // Now guaranteed non-null
    },
  });
});

export const adminAuthProcedure = t.procedure.use(isAdminAuthenticated);

/**
 * Restrict an admin procedure to specific roles (e.g. SUPER_ADMIN only).
 * VIEWER is read-only; use this to guard mutations.
 */
export function requireAdminRole(...roles: string[]) {
  return adminAuthProcedure.use(async ({ ctx, next }) => {
    if (!roles.includes(ctx.admin.role)) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Você não tem permissão para esta ação',
      });
    }
    return next();
  });
}

/**
 * Middleware: Rate limiting
 */
export function getClientIp(ctx: Context): string {
  // The edge proxy appends the real client IP as the LAST hop; anything to
  // the left is client-controlled and must not be trusted.
  const xff = ctx.honoContext.req.header('x-forwarded-for');
  const lastHop = xff?.split(',').map((s) => s.trim()).filter(Boolean).pop();
  return lastHop || ctx.honoContext.req.header('x-real-ip') || 'unknown';
}

export function withRateLimit(limit: number, windowSeconds: number) {
  return t.middleware(async ({ ctx, next, path }) => {
    // Separate bucket per procedure, keyed by user (or IP when anonymous)
    const key = ctx.user?.id || getClientIp(ctx);
    const rateLimitKey = `ratelimit:${path}:${key}`;

    const allowed = await checkRateLimit(rateLimitKey, limit, windowSeconds);

    if (!allowed) {
      throw new TRPCError({
        code: 'TOO_MANY_REQUESTS',
        message: 'Rate limit exceeded. Please try again later.',
      });
    }

    return next();
  });
}

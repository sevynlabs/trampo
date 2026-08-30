import * as jose from 'jose';
import { env } from './env';

/**
 * Admin panel JWTs.
 *
 * Kept separate from the mobile user tokens (lib/jwt.ts) by using a distinct
 * audience (`trampo-admin`) and payload `type: 'admin'`. This means a mobile
 * access token can never satisfy an admin procedure and vice-versa, even
 * though both are signed with the same JWT_SECRET.
 */

const ALGORITHM = 'HS256';
const ISSUER = 'trampo';
const AUDIENCE = 'trampo-admin';

// Admin session: 24 hours
const ADMIN_TOKEN_EXPIRY = '24h';

export interface AdminJWTPayload {
  sub: string; // AdminUser ID
  email: string;
  role: string;
  type: 'admin';
}

export async function generateAdminToken(admin: {
  id: string;
  email: string;
  role: string;
}): Promise<string> {
  const secret = new TextEncoder().encode(env.JWT_SECRET);

  return new jose.SignJWT({ email: admin.email, role: admin.role, type: 'admin' })
    .setProtectedHeader({ alg: ALGORITHM })
    .setSubject(admin.id)
    .setIssuedAt()
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setExpirationTime(ADMIN_TOKEN_EXPIRY)
    .sign(secret);
}

export async function verifyAdminToken(token: string): Promise<AdminJWTPayload | null> {
  try {
    const secret = new TextEncoder().encode(env.JWT_SECRET);

    const { payload } = await jose.jwtVerify(token, secret, {
      issuer: ISSUER,
      audience: AUDIENCE,
    });

    if (!payload.sub || !payload.email || !payload.role || payload.type !== 'admin') {
      return null;
    }

    return {
      sub: payload.sub as string,
      email: payload.email as string,
      role: payload.role as string,
      type: 'admin',
    };
  } catch (error) {
    if (!(error instanceof jose.errors.JWTExpired)) {
      console.error('[ADMIN-JWT] Verification failed:', error);
    }
    return null;
  }
}

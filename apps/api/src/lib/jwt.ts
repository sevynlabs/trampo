import * as jose from 'jose';
import { env } from './env';

const ALGORITHM = 'HS256';
const ISSUER = 'trampo';
const AUDIENCE = 'trampo-app';

// Access token: 15 minutes
const ACCESS_TOKEN_EXPIRY = '15m';

// Refresh token: 30 days
const REFRESH_TOKEN_EXPIRY = '30d';

/**
 * JWT Payload structure
 */
export interface JWTPayload {
  sub: string; // User ID
  phone: string;
  role: string;
  type: 'access' | 'refresh';
}

/**
 * Generate access token (short-lived)
 */
export async function generateAccessToken(payload: Omit<JWTPayload, 'type'>): Promise<string> {
  const secret = new TextEncoder().encode(env.JWT_SECRET);

  const token = await new jose.SignJWT({ ...payload, type: 'access' })
    .setProtectedHeader({ alg: ALGORITHM })
    .setIssuedAt()
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setExpirationTime(ACCESS_TOKEN_EXPIRY)
    .sign(secret);

  return token;
}

/**
 * Generate refresh token (long-lived)
 */
export async function generateRefreshToken(payload: Omit<JWTPayload, 'type'>): Promise<string> {
  const secret = new TextEncoder().encode(env.JWT_SECRET);

  const token = await new jose.SignJWT({ ...payload, type: 'refresh' })
    .setProtectedHeader({ alg: ALGORITHM })
    .setIssuedAt()
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setExpirationTime(REFRESH_TOKEN_EXPIRY)
    .sign(secret);

  return token;
}

/**
 * Verify and decode JWT
 */
export async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const secret = new TextEncoder().encode(env.JWT_SECRET);

    const { payload } = await jose.jwtVerify(token, secret, {
      issuer: ISSUER,
      audience: AUDIENCE,
    });

    // Validate required fields
    if (!payload.sub || !payload.phone || !payload.role || !payload.type) {
      console.error('[JWT] Missing required payload fields');
      return null;
    }

    return {
      sub: payload.sub as string,
      phone: payload.phone as string,
      role: payload.role as string,
      type: payload.type as 'access' | 'refresh',
    };
  } catch (error) {
    if (error instanceof jose.errors.JWTExpired) {
      console.log('[JWT] Token expired');
    } else if (error instanceof jose.errors.JWTClaimValidationFailed) {
      console.error('[JWT] Claim validation failed:', error.message);
    } else {
      console.error('[JWT] Verification failed:', error);
    }
    return null;
  }
}

/**
 * Generate token pair (access + refresh)
 */
export async function generateTokenPair(user: {
  id: string;
  phone: string;
  role: string;
}): Promise<{ accessToken: string; refreshToken: string }> {
  const payload = {
    sub: user.id,
    phone: user.phone,
    role: user.role,
  };

  const [accessToken, refreshToken] = await Promise.all([
    generateAccessToken(payload),
    generateRefreshToken(payload),
  ]);

  return { accessToken, refreshToken };
}

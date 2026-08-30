/** Shared constants safe to import from the Edge middleware (no heavy deps). */

/** Name of the httpOnly cookie holding the admin JWT. */
export const ADMIN_COOKIE = "admin_token";

/** Cookie max-age in seconds (24h — matches the admin JWT expiry). */
export const ADMIN_COOKIE_MAX_AGE = 60 * 60 * 24;

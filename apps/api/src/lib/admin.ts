import { env } from './env';

/**
 * Admin allowlist, parsed once from ADMIN_USER_IDS (comma-separated UUIDs).
 * Single source of truth for backoffice authorization.
 */
export const adminUserIds = new Set(
  env.ADMIN_USER_IDS.split(',')
    .map((id) => id.trim())
    .filter(Boolean)
);

export function isAdminUser(userId: string): boolean {
  return adminUserIds.has(userId);
}

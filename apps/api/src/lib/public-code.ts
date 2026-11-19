/**
 * The user's public in-app ID ("ID no Trampo"), shown in the app profile,
 * the business card and the admin panel. Stored as "TR4F9A2C".
 */

/** "TR4F9A2C" → "TR-4F9A2C" (idempotent). */
export const formatPublicCode = (code: string) => (code.includes('-') ? code : `${code.slice(0, 2)}-${code.slice(2)}`);

/** Accepts "TR-4F9A2C", "tr4f9a2c", "#TR 4F9A2C"… → "TR4F9A2C" (or null). */
export function parsePublicCode(raw: string): string | null {
  const c = raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
  return /^TR[0-9A-F]{6}$/.test(c) ? c : null;
}

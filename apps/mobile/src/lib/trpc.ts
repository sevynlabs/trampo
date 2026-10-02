import { createTRPCReact } from '@trpc/react-query';
import { httpBatchLink } from '@trpc/client';
import superjson from 'superjson';
import * as SecureStore from 'expo-secure-store';
import type { AppRouter } from '@trampo/api/src/router';

// NEVER store tokens in AsyncStorage - use SecureStore
const ACCESS_TOKEN_KEY = 'trampo_access_token';
const REFRESH_TOKEN_KEY = 'trampo_refresh_token';

export async function getToken(): Promise<string | null> {
  return SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
}

export async function getRefreshToken(): Promise<string | null> {
  return SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
}

export async function setTokens(accessToken: string, refreshToken: string): Promise<void> {
  await Promise.all([
    SecureStore.setItemAsync(ACCESS_TOKEN_KEY, accessToken),
    SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken),
  ]);
}

// Legacy function for backwards compatibility
export async function setToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, token);
}

export async function clearTokens(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY),
    SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY),
  ]);
}

// Legacy alias
export const clearToken = clearTokens;

export const trpc = createTRPCReact<AppRouter>();

/** Called when the session can't be renewed (refresh token expired/revoked). */
let onSessionExpired: (() => void) | null = null;
export function setOnSessionExpired(handler: () => void) {
  onSessionExpired = handler;
}

// Single in-flight refresh shared by every request that hit a 401, so a burst
// of parallel queries doesn't rotate the refresh token several times.
let refreshInFlight: Promise<boolean> | null = null;

async function refreshSession(apiUrl: string): Promise<boolean> {
  const refreshToken = await getRefreshToken();
  if (!refreshToken) return false;

  try {
    const res = await fetch(`${apiUrl}/trpc/auth.refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(superjson.serialize({ refreshToken })),
    });
    if (!res.ok) return false;
    const body = await res.json();
    const tokens = superjson.deserialize<{ accessToken: string; refreshToken: string }>(
      body.result.data
    );
    await setTokens(tokens.accessToken, tokens.refreshToken);
    return true;
  } catch {
    return false;
  }
}

function refreshOnce(apiUrl: string): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = refreshSession(apiUrl).finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

export function createTRPCClient(apiUrl: string) {
  return trpc.createClient({
    links: [
      httpBatchLink({
        url: `${apiUrl}/trpc`,
        transformer: superjson,
        async headers() {
          const token = await getToken();
          return token ? { Authorization: `Bearer ${token}` } : {};
        },
        // Access tokens live 15 min: on a 401, renew the session once and
        // replay the request with the new token.
        async fetch(url, options) {
          const res = await fetch(url, options);
          if (res.status !== 401 || String(url).includes('auth.')) {
            return res;
          }

          const hadSession = !!(await getRefreshToken());
          const renewed = await refreshOnce(apiUrl);
          if (!renewed) {
            if (hadSession) {
              await clearTokens();
              onSessionExpired?.();
            }
            return res;
          }

          const token = await getToken();
          const headers = new Headers(options?.headers as HeadersInit | undefined);
          headers.set('Authorization', `Bearer ${token}`);
          return fetch(url, { ...options, headers });
        },
      }),
    ],
  });
}

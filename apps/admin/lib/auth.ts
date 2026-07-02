import { createTRPCClient, httpBatchLink } from "@trpc/client";
import superjson from "superjson";
import type { AppRouter } from "@trampo/api/src/router";

/** Name of the httpOnly cookie holding the admin JWT. */
export const ADMIN_COOKIE = "admin_token";

/** Cookie max-age in seconds (24h — matches the admin JWT expiry). */
export const ADMIN_COOKIE_MAX_AGE = 60 * 60 * 24;

const API_URL = process.env.API_URL || "http://localhost:3000";

/**
 * Server-side vanilla tRPC client used inside route handlers / server code.
 * Talks directly to the API. Pass a token to authenticate as an admin.
 */
export function serverTrpc(token?: string) {
  return createTRPCClient<AppRouter>({
    links: [
      httpBatchLink({
        url: `${API_URL}/trpc`,
        transformer: superjson,
        headers() {
          return token ? { Authorization: `Bearer ${token}` } : {};
        },
      }),
    ],
  });
}

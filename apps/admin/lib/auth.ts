import { createTRPCClient, httpBatchLink } from "@trpc/client";
import superjson from "superjson";
import type { AppRouter } from "@trampo/api/src/router";

// Re-export cookie constants (defined in a dep-free module so the Edge
// middleware can import them without pulling in the tRPC client).
export { ADMIN_COOKIE, ADMIN_COOKIE_MAX_AGE } from "./constants";

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

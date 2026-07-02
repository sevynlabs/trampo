import { createTRPCReact } from "@trpc/react-query";
import type { AppRouter } from "@trampo/api/src/router";

/**
 * React Query tRPC hooks for the admin panel.
 *
 * The client talks to the same-origin proxy at `/api/trpc` (see
 * app/api/trpc/[trpc]/route.ts), which injects the httpOnly admin JWT
 * cookie as a Bearer token before forwarding to the real API. This keeps
 * the token out of client-side JS.
 */
export const trpc = createTRPCReact<AppRouter>();

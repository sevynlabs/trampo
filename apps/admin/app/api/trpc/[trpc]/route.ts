import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { ADMIN_COOKIE } from "@/lib/auth";

const API_URL = process.env.API_URL || "http://localhost:3000";

/**
 * Same-origin tRPC proxy.
 *
 * Forwards `/api/trpc/*` to `${API_URL}/trpc/*`, attaching the admin JWT from
 * the httpOnly cookie as a Bearer token. The browser never sees the token.
 */
async function handler(
  req: NextRequest,
  { params }: { params: { trpc: string } }
) {
  const token = cookies().get(ADMIN_COOKIE)?.value;
  const search = new URL(req.url).search;
  const target = `${API_URL}/trpc/${params.trpc}${search}`;

  const headers = new Headers();
  const contentType = req.headers.get("content-type");
  if (contentType) headers.set("content-type", contentType);
  if (token) headers.set("authorization", `Bearer ${token}`);

  const body =
    req.method === "GET" || req.method === "HEAD"
      ? undefined
      : await req.text();

  const upstream = await fetch(target, {
    method: req.method,
    headers,
    body,
    cache: "no-store",
  });

  const responseBody = await upstream.text();
  return new Response(responseBody, {
    status: upstream.status,
    headers: {
      "content-type":
        upstream.headers.get("content-type") || "application/json",
    },
  });
}

export { handler as GET, handler as POST };

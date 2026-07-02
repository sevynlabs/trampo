import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { ADMIN_COOKIE } from "@/lib/auth";

/**
 * Route guard for the admin panel.
 *
 * Presence-check only — the API enforces real JWT validation on every tRPC
 * call via adminAuthProcedure. This just keeps unauthenticated browsers off
 * the dashboard and bounces logged-in admins away from /login.
 */
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const hasToken = Boolean(req.cookies.get(ADMIN_COOKIE)?.value);
  const isLoginRoute = pathname === "/login";

  if (isLoginRoute) {
    if (hasToken) {
      return NextResponse.redirect(new URL("/", req.url));
    }
    return NextResponse.next();
  }

  if (!hasToken) {
    const loginUrl = new URL("/login", req.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  // Run on everything except API routes, Next internals, and static files.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};

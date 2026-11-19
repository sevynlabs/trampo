import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { ADMIN_COOKIE } from "@/lib/constants";

/**
 * Route guard for the admin panel.
 *
 * Presence-check only — the API enforces real JWT validation on every tRPC
 * call via adminAuthProcedure. This just keeps unauthenticated browsers off
 * the dashboard and bounces logged-in admins away from /login.
 */
/** Public pages linked from the app stores (no login). */
const PUBLIC_PATHS = ["/privacidade", "/termos", "/suporte", "/excluir-conta"];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC_PATHS.includes(pathname)) return NextResponse.next();
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
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|icon.png).*)"],
};

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { ADMIN_COOKIE } from "@/lib/constants";

/**
 * One Next.js app serves two addresses:
 *
 * - Public site (trampooficial.com): home + the pages the app stores link to
 *   (privacy, terms, support, account deletion). No login.
 * - Admin panel (admin.trampooficial.com): everything else, behind login.
 *
 * The login check is presence-only — the API validates the admin JWT on every
 * tRPC call (adminAuthProcedure). This just keeps browsers off the dashboard.
 */

/** Public pages linked from the app stores (no login on any host). */
const PUBLIC_PATHS = ["/inicio", "/privacidade", "/termos", "/suporte", "/excluir-conta"];

/** Hosts that show the public site instead of the panel. */
const SITE_HOSTS = (process.env.SITE_HOSTS ?? "trampooficial.com,www.trampooficial.com")
  .split(",")
  .map((h) => h.trim().toLowerCase())
  .filter(Boolean);

const ADMIN_URL = process.env.ADMIN_URL ?? "https://admin.trampooficial.com";

/**
 * Absolute URL on the host the visitor actually used. Behind Railway's proxy
 * `req.url` points at the internal server (localhost), so redirects built
 * from it would send people to localhost.
 */
function onSameHost(req: NextRequest, path: string): URL {
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  const proto = req.headers.get("x-forwarded-proto") ?? (process.env.NODE_ENV === "production" ? "https" : "http");
  return host ? new URL(path, `${proto}://${host}`) : new URL(path, req.url);
}

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const host = (req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "").split(":")[0].toLowerCase();

  // Public site: home at "/", store pages, anything else goes to the panel
  if (SITE_HOSTS.includes(host)) {
    // Redirect (not rewrite): behind Railway's TLS proxy Next treats a
    // rewrite to its own https origin as an external proxy and fails.
    if (pathname === "/") return NextResponse.redirect(onSameHost(req, "/inicio"));
    if (PUBLIC_PATHS.includes(pathname)) return NextResponse.next();
    return NextResponse.redirect(new URL(pathname + search, ADMIN_URL));
  }

  if (PUBLIC_PATHS.includes(pathname)) return NextResponse.next();

  const hasToken = Boolean(req.cookies.get(ADMIN_COOKIE)?.value);
  const isLoginRoute = pathname === "/login";

  if (isLoginRoute) {
    if (hasToken) {
      return NextResponse.redirect(onSameHost(req, "/"));
    }
    return NextResponse.next();
  }

  if (!hasToken) {
    return NextResponse.redirect(onSameHost(req, "/login"));
  }

  return NextResponse.next();
}

export const config = {
  // Run on everything except API routes, Next internals, and static files.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|icon.png).*)"],
};

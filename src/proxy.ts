import { auth } from "@/auth";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Routes reachable while logged OUT. Everything NOT listed here requires a session, so a page
 * that forgets its own `auth()` is now guarded centrally (fail-closed) instead of silently
 * rendering a shell. This is a backstop on top of each page's own `auth()` and DB-level RLS —
 * NOT a replacement: the guard only checks that *a* session exists, not org membership, so
 * pages must still do their own `getCurrentUserOrg()` / ownership checks.
 *
 * The entire `/family-discipleship` subtree is intentionally absent → it requires login.
 * When you add a genuinely public page, add its path here; new *protected* pages need no change.
 */
const PUBLIC_ROUTES = new Set([
  "/login",
  "/signup",
  "/privacy",
  "/terms",
  "/about",
  "/changelog",
]);

function isPublicRoute(pathname: string): boolean {
  // Normalize a trailing slash (except the root) before the exact-match check.
  const path =
    pathname.length > 1 && pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
  return PUBLIC_ROUTES.has(path);
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (isPublicRoute(pathname)) {
    return NextResponse.next();
  }

  const session = await auth();
  if (!session?.user) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  return NextResponse.next();
}

// Don't run Proxy on API routes, Next internals, the static `/assets/*` tree (e.g. the login
// page's logo — otherwise the guard would redirect it to /login), or favicon.
export const config = {
  matcher: ["/((?!api|_next/static|_next/image|assets|favicon.ico).*)"],
};

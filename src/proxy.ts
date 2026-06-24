import { auth } from "@/auth";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  ACTIVE_PROFILE_COOKIE,
  activeProfileCookieOptions,
  signActiveProfile,
  verifyActiveProfile,
  type ProfileType,
} from "@/lib/active-profile-cookie";
import { profileGateDecision } from "@/lib/profile-access";

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
  "/waitlist",
]);

function isPublicRoute(pathname: string): boolean {
  // Normalize a trailing slash (except the root) before the exact-match check.
  const path =
    pathname.length > 1 && pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
  return PUBLIC_ROUTES.has(path);
}

const RESTAMP_AFTER_SECONDS = 5 * 60; // re-issue a PARENT cookie at most once per ~5 min of activity
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // browser retention; idle is enforced server-side via iat

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (isPublicRoute(pathname)) {
    return NextResponse.next();
  }

  const session = await auth();
  if (!session?.user) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  // Resolve the active profile TYPE from the signed cookie — at the edge, no DB hit. The cookie is
  // only trusted if its signature/idle is valid AND it is bound to THIS login + org.
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  const raw = req.cookies.get(ACTIVE_PROFILE_COOKIE)?.value;
  const userId = session.user.id;
  const orgId = (session.user as { organizationId?: string }).organizationId;

  let activeType: ProfileType | null = null;
  let token: Awaited<ReturnType<typeof verifyActiveProfile>> = null;
  if (raw && secret) {
    token = await verifyActiveProfile(raw, secret, Date.now());
    if (token && token.uid === userId && token.org === orgId) {
      activeType = token.type;
    }
  }

  if (profileGateDecision(pathname, activeType) === "picker") {
    return NextResponse.redirect(new URL("/select-profile", req.url));
  }

  // Allowed. Sliding idle: refresh an aging PARENT cookie so continued activity keeps it alive.
  const res = NextResponse.next();
  if (activeType === "PARENT" && token && secret) {
    const ageSeconds = Math.floor(Date.now() / 1000) - token.iat;
    if (ageSeconds > RESTAMP_AFTER_SECONDS) {
      const fresh = await signActiveProfile(
        { profileId: token.profileId, type: token.type, uid: token.uid, org: token.org },
        secret,
        Date.now(),
      );
      res.cookies.set(ACTIVE_PROFILE_COOKIE, fresh, {
        ...activeProfileCookieOptions(),
        maxAge: COOKIE_MAX_AGE,
      });
    }
  }
  return res;
}

// Don't run Proxy on API routes, Next internals, the static `/assets/*` tree (e.g. the login
// page's logo — otherwise the guard would redirect it to /login), favicon, or the PWA web
// manifest (must stay publicly fetchable so "Add to Home Screen" works while logged out).
export const config = {
  matcher: ["/((?!api|_next/static|_next/image|assets|favicon.ico|manifest.webmanifest).*)"],
};

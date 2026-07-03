import type { ProfileType } from "@/lib/active-profile-cookie";

/** The picker route (and its subpaths). Reachable by any logged-in user, profile or not. */
export function isSelectProfilePath(pathname: string): boolean {
  return pathname === "/select-profile" || pathname.startsWith("/select-profile/");
}

/**
 * The onboarding route (and its subpaths). A brand-new user has no org yet — and therefore no
 * profile to pick — so onboarding is the OTHER surface reachable before a profile exists. Without
 * this exemption a null-profile user is bounced to /select-profile, which redirects a null-org user
 * to /onboarding, which the gate bounces back → infinite loop. See `profileGateDecision`.
 */
export function isOnboardingPath(pathname: string): boolean {
  return pathname === "/onboarding" || pathname.startsWith("/onboarding/");
}

/**
 * Routes an active STUDENT profile may reach. NON-clean-prefix carve-outs (e.g. `/courses/[id]/learn`
 * is open while the rest of `/courses/**` is admin), so this is an ordered set of explicit matchers.
 * `/courses/[id]/learn` is reserved (not built yet) — allowed now so it works the moment it lands.
 */
const STUDENT_ROUTE_MATCHERS: RegExp[] = [
  /^\/$/,
  /^\/courses\/[^/]+\/learn$/,
  /^\/living-library\/resource\/[^/]+$/,
  /^\/family-discipleship(?:\/.*)?$/,
  /^\/students\/[^/]+\/family-discipleship(?:\/.*)?$/,
];

export function isStudentAllowed(pathname: string): boolean {
  if (isSelectProfilePath(pathname)) return true;
  return STUDENT_ROUTE_MATCHERS.some((re) => re.test(pathname));
}

/**
 * The proxy gate decision for a (non-public, authenticated) request, given the active profile type
 * resolved from the signed cookie (or null when there is no valid active profile).
 */
export function profileGateDecision(
  pathname: string,
  activeType: ProfileType | null,
): "allow" | "picker" {
  if (activeType === "PARENT") return "allow";
  if (activeType === "STUDENT") return isStudentAllowed(pathname) ? "allow" : "picker";
  // No active profile: the only reachable surfaces are the picker and onboarding (a not-yet-onboarded
  // user has no org, so no profile to pick — they must onboard first). Anything else → the picker.
  return isSelectProfilePath(pathname) || isOnboardingPath(pathname) ? "allow" : "picker";
}

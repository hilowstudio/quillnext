import type { ProfileType } from "@/lib/active-profile-cookie";

/** The picker route (and its subpaths). Reachable by any logged-in user, profile or not. */
export function isSelectProfilePath(pathname: string): boolean {
  return pathname === "/select-profile" || pathname.startsWith("/select-profile/");
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
  return isSelectProfilePath(pathname) ? "allow" : "picker";
}

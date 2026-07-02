import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { getCurrentUserOrg } from "@/lib/auth-helpers";
import { withTenant } from "@/server/db";
import {
  ACTIVE_PROFILE_COOKIE,
  activeProfileCookieOptions,
  signActiveProfile,
  verifyActiveProfile,
  type ProfileType,
} from "@/lib/active-profile-cookie";

/** Fields safe to expose. NEVER selects pin_hash. */
const activeProfileSelect = {
  id: true,
  organizationId: true,
  type: true,
  displayName: true,
  avatarConfig: true,
  viewMode: true,
  userId: true,
  isOwner: true,
} as const;

function authSecret(): string {
  const s = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET (or NEXTAUTH_SECRET) is not set");
  return s;
}

/**
 * The authoritative active profile for the current request, or null.
 * Fail-closed at every step: not logged in, no/invalid cookie, cookie not bound
 * to this login/org, or profile missing/out-of-org all return null.
 *
 * Exported un-cached for testability; the app should import `getActiveProfile`.
 */
export async function loadActiveProfile() {
  // Must be logged in. getCurrentUserOrg throws when unauthenticated -> treat as no profile.
  let rawCtx: { userId: string; organizationId: string | null };
  try {
    rawCtx = await getCurrentUserOrg();
  } catch {
    return null;
  }
  // An org-less user cannot have a profile — fail closed.
  if (!rawCtx.organizationId) return null;
  const ctx = { userId: rawCtx.userId, organizationId: rawCtx.organizationId };

  const raw = (await cookies()).get(ACTIVE_PROFILE_COOKIE)?.value;
  if (!raw) return null;

  const token = await verifyActiveProfile(raw, authSecret(), Date.now());
  if (!token) return null;

  // Defense in depth: the cookie must belong to THIS login + tenant.
  if (token.uid !== ctx.userId || token.org !== ctx.organizationId) return null;

  const profile = await withTenant(
    (tx) =>
      tx.profile.findUnique({
        where: { id: token.profileId },
        select: activeProfileSelect,
      }),
    undefined,
    { organizationId: ctx.organizationId, userId: null },
  );

  if (!profile || profile.organizationId !== ctx.organizationId) return null;
  return profile;
}

/** Request-deduped active profile (mirrors getStudentById's cache() pattern). */
export const getActiveProfile = cache(loadActiveProfile);


/**
 * Sign + set the active_profile cookie for the current login.
 * Callers (the picker action in Slice 3, verifyProfilePin in Slice 5) MUST authorize
 * the profile (in-org, PIN if required) BEFORE calling this. Server Action / Route Handler only.
 */
export async function setActiveProfile(input: { profileId: string; type: ProfileType }): Promise<void> {
  const rawCtx = await getCurrentUserOrg();
  if (!rawCtx.organizationId) throw new Error("User has no organization");
  const ctx = { userId: rawCtx.userId, organizationId: rawCtx.organizationId };
  const token = await signActiveProfile(
    { profileId: input.profileId, type: input.type, uid: ctx.userId, org: ctx.organizationId },
    authSecret(),
    Date.now(),
  );
  (await cookies()).set(ACTIVE_PROFILE_COOKIE, token, {
    ...activeProfileCookieOptions(),
    maxAge: 60 * 60 * 24 * 30, // browser retention; PARENT idle is still enforced server-side via iat
  });
}

/** Clear the active_profile cookie ("Switch Profile" / logout). Server Action / Route Handler only. */
export async function clearActiveProfile(): Promise<void> {
  // Overwrite with an immediately-expiring cookie so the matching domain/path is cleared in prod.
  (await cookies()).set(ACTIVE_PROFILE_COOKIE, "", {
    ...activeProfileCookieOptions(),
    maxAge: 0,
  });
}

"use server";

import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { getCurrentUserOrg } from "@/lib/auth-helpers";
import { withTenant } from "@/server/db";
import { setActiveProfile, clearActiveProfile } from "@/server/profiles/active-profile";
import {
  checkProfilePinThrottle,
  recordProfilePinFailure,
  clearProfilePinThrottle,
} from "@/server/profiles/pin-throttle";

export type SelectProfileResult = { ok: false; error: string };

/**
 * Select a profile and start its session. For PIN-protected profiles, verifies the PIN (bcrypt,
 * rate-limited) before setting the cookie. On success this REDIRECTS to "/" and never returns;
 * only failures return a result the client can show.
 */
export async function selectProfile(profileId: string, pin?: string): Promise<SelectProfileResult> {
  const { organizationId } = await getCurrentUserOrg();
  if (!organizationId) return { ok: false, error: "No organization." };

  // pinHash is read here (server-only) for verification — it is never returned to the client.
  const profile = await withTenant(
    (tx) =>
      tx.profile.findUnique({
        where: { id: profileId },
        select: { id: true, organizationId: true, type: true, pinHash: true },
      }),
    undefined,
    { organizationId, userId: null },
  );

  if (!profile || profile.organizationId !== organizationId) {
    return { ok: false, error: "Profile not found." };
  }

  if (profile.pinHash) {
    const gate = await checkProfilePinThrottle(profile.id, organizationId, Date.now());
    if (!gate.allowed) {
      return { ok: false, error: `Too many attempts. Try again in ${Math.ceil(gate.retryAfterMs / 1000)}s.` };
    }
    const ok = pin ? await bcrypt.compare(pin, profile.pinHash) : false;
    if (!ok) {
      await recordProfilePinFailure(profile.id, organizationId, Date.now());
      return { ok: false, error: "Incorrect PIN." };
    }
    await clearProfilePinThrottle(profile.id, organizationId);
  }

  await setActiveProfile({ profileId: profile.id, type: profile.type });
  redirect("/");
}

/**
 * PIN-verify the org's owner PARENT profile (bcrypt, rate-limited) and set it active. Shared by the
 * parent-only entry points below; the caller redirects to its destination on success. No cookie is
 * set unless the PIN check passes. On failure returns a result the client can show.
 */
async function enterAsOwnerParent(pin?: string): Promise<{ ok: true } | SelectProfileResult> {
  const { organizationId } = await getCurrentUserOrg();
  if (!organizationId) return { ok: false, error: "No organization." };

  const owner = await withTenant(
    (tx) =>
      tx.profile.findFirst({
        where: { organizationId, type: "PARENT", isOwner: true },
        select: { id: true, pinHash: true },
      }),
    undefined,
    { organizationId, userId: null },
  );
  if (!owner) return { ok: false, error: "No owner profile." };

  if (owner.pinHash) {
    const gate = await checkProfilePinThrottle(owner.id, organizationId, Date.now());
    if (!gate.allowed) {
      return { ok: false, error: `Too many attempts. Try again in ${Math.ceil(gate.retryAfterMs / 1000)}s.` };
    }
    const ok = pin ? await bcrypt.compare(pin, owner.pinHash) : false;
    if (!ok) {
      await recordProfilePinFailure(owner.id, organizationId, Date.now());
      return { ok: false, error: "Incorrect PIN." };
    }
    await clearProfilePinThrottle(owner.id, organizationId);
  }

  await setActiveProfile({ profileId: owner.id, type: "PARENT" });
  return { ok: true };
}

/**
 * Enter PARENT-only profile management from the picker: become the owner PARENT (PIN-gated) and land
 * on /manage-profiles (which the proxy gates to PARENT). On success this REDIRECTS and never returns;
 * only failures return a result.
 */
export async function enterProfileManagement(pin?: string): Promise<SelectProfileResult> {
  const res = await enterAsOwnerParent(pin);
  if (!res.ok) return res;
  redirect("/manage-profiles");
}

/**
 * Parent-gated entry to a learner's personality assessment from the picker: become the owner PARENT
 * (PIN-gated), then land on /students/[id]/assessment — a PARENT route the picker's no-active-profile
 * state can't otherwise reach. `studentId` is restricted to an id-safe charset so it can't smuggle
 * anything else into the redirect path. REDIRECTS on success; only failures return a result.
 */
export async function enterAssessment(studentId: string, pin?: string): Promise<SelectProfileResult> {
  if (!/^[A-Za-z0-9_-]+$/.test(studentId)) return { ok: false, error: "Invalid student." };
  const res = await enterAsOwnerParent(pin);
  if (!res.ok) return res;
  redirect(`/students/${studentId}/assessment`);
}

/** Clear the active profile and return to the picker ("Switch Profile"). */
export async function switchProfile(): Promise<void> {
  await clearActiveProfile();
  redirect("/select-profile");
}

"use server";

import bcrypt from "bcryptjs";
import { getCurrentUserOrg } from "@/lib/auth-helpers";
import { withTenant } from "@/server/db";
import { assertParentProfile } from "@/server/profiles/guards";
import { pinSchema } from "@/lib/schemas/pin";
import { verifyPinWithThrottle } from "@/server/profiles/pin-verify";

export type PinActionResult = { ok: true } | { ok: false; error: string };

async function ownedProfile(profileId: string, organizationId: string) {
  return withTenant(
    (tx) => tx.profile.findUnique({ where: { id: profileId }, select: { id: true, organizationId: true } }),
    undefined,
    { organizationId, userId: null },
  );
}

/** Set or change a profile's PIN. PARENT-only; org-scoped. */
export async function setProfilePin(profileId: string, pin: string): Promise<PinActionResult> {
  await assertParentProfile();
  const parsed = pinSchema.safeParse(pin);
  if (!parsed.success) return { ok: false, error: "PIN must be exactly 4 digits." };

  const { organizationId } = await getCurrentUserOrg();
  if (!organizationId) return { ok: false, error: "No organization." };

  const profile = await ownedProfile(profileId, organizationId);
  if (!profile || profile.organizationId !== organizationId) return { ok: false, error: "Profile not found." };

  const pinHash = await bcrypt.hash(parsed.data, 10);
  await withTenant(
    (tx) => tx.profile.update({ where: { id: profileId }, data: { pinHash, pinFailedCount: 0, pinWindowStart: null } }),
    undefined,
    { organizationId, userId: null },
  );
  return { ok: true };
}

/** Remove a profile's PIN. PARENT-only; org-scoped. */
export async function removeProfilePin(profileId: string): Promise<PinActionResult> {
  await assertParentProfile();
  const { organizationId } = await getCurrentUserOrg();
  if (!organizationId) return { ok: false, error: "No organization." };

  const profile = await ownedProfile(profileId, organizationId);
  if (!profile || profile.organizationId !== organizationId) return { ok: false, error: "Profile not found." };

  await withTenant(
    (tx) => tx.profile.update({ where: { id: profileId }, data: { pinHash: null, pinFailedCount: 0, pinWindowStart: null } }),
    undefined,
    { organizationId, userId: null },
  );
  return { ok: true };
}

/**
 * Verify a profile's PIN with NO side effect beyond the throttle counters. Returns ok:true when the
 * profile has no PIN (nothing to verify). org-scoped, rate-limited. Deliberately NOT PARENT-guarded —
 * it gates editing a profile's own avatar from the picker (where there is no active profile yet).
 */
export async function verifyProfilePin(profileId: string, pin: string): Promise<PinActionResult> {
  const { organizationId } = await getCurrentUserOrg();
  if (!organizationId) return { ok: false, error: "No organization." };

  const profile = await withTenant(
    (tx) => tx.profile.findUnique({ where: { id: profileId }, select: { id: true, organizationId: true, pinHash: true } }),
    undefined,
    { organizationId, userId: null },
  );
  if (!profile || profile.organizationId !== organizationId) return { ok: false, error: "Profile not found." };

  return verifyPinWithThrottle(profile.id, organizationId, profile.pinHash, pin);
}

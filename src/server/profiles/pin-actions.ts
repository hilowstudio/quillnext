"use server";

import bcrypt from "bcryptjs";
import { getCurrentUserOrg } from "@/lib/auth-helpers";
import { withTenant } from "@/server/db";
import { assertParentProfile } from "@/server/profiles/guards";
import { pinSchema } from "@/lib/schemas/pin";

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

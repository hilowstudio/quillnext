"use server";

import { getCurrentUserOrg } from "@/lib/auth-helpers";
import { withTenant } from "@/server/db";
import { verifyProfilePin, type PinActionResult } from "@/server/profiles/pin-actions";

/**
 * Update a profile's avatar. Anyone in the org may edit (it's cosmetic), BUT if the profile is
 * PIN-protected the correct PIN must be supplied (verified + rate-limited server-side). Writes
 * Profile.avatarConfig and syncs the linked Learner.avatarConfig so the student dashboard matches.
 */
export async function setProfileAvatar(profileId: string, config: unknown, pin?: string): Promise<PinActionResult> {
  const { organizationId } = await getCurrentUserOrg();
  if (!organizationId) return { ok: false, error: "No organization." };

  const profile = await withTenant(
    (tx) =>
      tx.profile.findUnique({
        where: { id: profileId },
        select: { id: true, organizationId: true, pinHash: true, learner: { select: { id: true } } },
      }),
    undefined,
    { organizationId, userId: null },
  );
  if (!profile || profile.organizationId !== organizationId) return { ok: false, error: "Profile not found." };

  if (profile.pinHash) {
    const verified = await verifyProfilePin(profileId, pin ?? "");
    if (!verified.ok) return verified;
  }

  const learnerId = profile.learner?.id;
  await withTenant(
    async (tx) => {
      await tx.profile.update({ where: { id: profileId }, data: { avatarConfig: config as never } });
      if (learnerId) {
        await tx.learner.update({ where: { id: learnerId }, data: { avatarConfig: config as never } });
      }
    },
    undefined,
    { organizationId, userId: null },
  );
  return { ok: true };
}

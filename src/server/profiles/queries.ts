import "server-only";
import { cache } from "react";
import { getCurrentUserOrg } from "@/lib/auth-helpers";
import { withTenant } from "@/server/db";
import { toProfileCard, type ProfileCard, type ProfileRow } from "./profile-card";

/** All profiles for the current org, as picker cards. pinHash is read server-side only (for hasPin). */
export const listOrganizationProfiles = cache(async (): Promise<ProfileCard[]> => {
  const { organizationId } = await getCurrentUserOrg();
  if (!organizationId) return [];

  const rows = await withTenant(
    (tx) =>
      tx.profile.findMany({
        where: { organizationId },
        select: {
          id: true, type: true, displayName: true,
          avatarConfig: true, viewMode: true, isOwner: true, pinHash: true,
        },
        orderBy: [{ isOwner: "desc" }, { type: "asc" }, { displayName: "asc" }],
      }),
    undefined,
    { organizationId, userId: null },
  );

  return (rows as ProfileRow[]).map(toProfileCard);
});

/** The learner id linked to a STUDENT profile (1:1 via Learner.profileId), or null. */
export const getLearnerIdForProfile = cache(
  async (profileId: string, organizationId: string): Promise<string | null> => {
    const learner = await withTenant(
      (tx) => tx.learner.findUnique({ where: { profileId }, select: { id: true } }),
      undefined,
      { organizationId, userId: null },
    );
    return learner?.id ?? null;
  },
);

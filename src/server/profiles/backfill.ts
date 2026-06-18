type UserRow = { id: string; name: string | null; organizationId: string | null };
type LearnerRow = {
  id: string; organizationId: string; firstName: string;
  preferredName: string | null; avatarConfig: unknown; profileId?: string | null;
};
type Opts = {
  // The owner (account-holder) user id per org — its PARENT profile is flagged is_owner and gets
  // the copied classroom PIN. `User.role` is NOT reliable for this (the live owner has role PARENT,
  // the schema default), so the runner derives the owner from the earliest user in the org.
  ownerUserIdByOrg: Record<string, string | undefined>;
  ownerPinHashByOrg: Record<string, string | undefined>;
  existingProfileUserIds?: Set<string>;
};

export type NewProfile = {
  id: string; organizationId: string; type: "PARENT" | "STUDENT";
  displayName: string; avatarConfig: unknown; pinHash: string | null;
  userId: string | null; isOwner: boolean;
};
export type LearnerLink = { learnerId: string; profileId: string };
export type Backfill = { profilesToCreate: NewProfile[]; learnerLinks: LearnerLink[] };

// Deterministic id from a stable seed so re-runs map to the same profile (no Math.random/Date).
const pid = (seed: string) => `profile-${seed}`;

export function buildProfileBackfill(users: UserRow[], learners: LearnerRow[], opts: Opts): Backfill {
  const existing = opts.existingProfileUserIds ?? new Set<string>();
  const profilesToCreate: NewProfile[] = [];
  const learnerLinks: LearnerLink[] = [];

  for (const u of users) {
    if (!u.organizationId || existing.has(u.id)) continue;
    const isOwner = opts.ownerUserIdByOrg[u.organizationId] === u.id;
    profilesToCreate.push({
      id: pid(`user-${u.id}`),
      organizationId: u.organizationId,
      type: "PARENT",
      displayName: u.name ?? "Parent",
      avatarConfig: null,
      pinHash: isOwner ? (opts.ownerPinHashByOrg[u.organizationId] ?? null) : null,
      userId: u.id,
      isOwner,
    });
  }

  for (const l of learners) {
    if (l.profileId) continue; // already linked
    const profileId = pid(`learner-${l.id}`);
    profilesToCreate.push({
      id: profileId,
      organizationId: l.organizationId,
      type: "STUDENT",
      displayName: l.preferredName ?? l.firstName,
      avatarConfig: l.avatarConfig ?? null,
      pinHash: null,
      userId: null,
      isOwner: false,
    });
    learnerLinks.push({ learnerId: l.id, profileId });
  }

  return { profilesToCreate, learnerLinks };
}

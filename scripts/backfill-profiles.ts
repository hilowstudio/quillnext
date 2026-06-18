import "dotenv/config";

// One-off, idempotent admin backfill: create a Profile per existing User (PARENT) and per Student
// (STUDENT), link each student to its profile, and copy the classroom PIN onto the owner's profile.
//
// Runs as the privileged DIRECT connection (postgres) — the same role migrations use — so it can
// read the org list and write across the tenant WITHOUT RLS GUC plumbing (postgres bypasses RLS).
// The app's `db` reads process.env.DATABASE_URL at import time, so we override it BEFORE importing.
process.env.DATABASE_URL = process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL;
process.env.RLS_ENABLED = "false";

(async () => {
  const { db } = await import("@/server/db");
  const { buildProfileBackfill } = await import("@/server/profiles/backfill");

  try {
    const orgs = await db.organization.findMany({ select: { id: true } });
    let createdProfiles = 0;
    let linkedLearners = 0;

    for (const { id: organizationId } of orgs) {
      const users = await db.user.findMany({
        where: { organizationId },
        select: { id: true, name: true, organizationId: true },
      });
      const learners = await db.learner.findMany({
        where: { organizationId },
        select: {
          id: true,
          organizationId: true,
          firstName: true,
          preferredName: true,
          avatarConfig: true,
          profileId: true,
        },
      });
      const existingProfileUserIds = new Set(
        (
          await db.profile.findMany({
            where: { organizationId, userId: { not: null } },
            select: { userId: true },
          })
        )
          .map((p) => p.userId)
          .filter((id): id is string => id !== null),
      );
      // Owner = the earliest user in the org. User.role is unreliable (the live owner is role
      // PARENT, the schema default), so we derive ownership from creation order.
      const ownerUser = await db.user.findFirst({
        where: { organizationId },
        orderBy: { createdAt: "asc" },
        select: { id: true },
      });

      const { profilesToCreate, learnerLinks } = buildProfileBackfill(users, learners, {
        ownerUserIdByOrg: { [organizationId]: ownerUser?.id },
        ownerPinHashByOrg: {}, // instructor_pin dropped (HYG-12); owner PIN now set at onboarding
        existingProfileUserIds,
      });

      for (const p of profilesToCreate) {
        await db.profile.create({
          data: {
            id: p.id,
            organizationId: p.organizationId,
            type: p.type,
            displayName: p.displayName,
            avatarConfig: (p.avatarConfig ?? undefined) as never,
            pinHash: p.pinHash,
            viewMode: "STANDARD",
            userId: p.userId,
            isOwner: p.isOwner,
          },
        });
      }
      for (const link of learnerLinks) {
        await db.learner.update({ where: { id: link.learnerId }, data: { profileId: link.profileId } });
      }
      createdProfiles += profilesToCreate.length;
      linkedLearners += learnerLinks.length;
    }

    console.log(
      `Backfill done: ${createdProfiles} profiles created, ${linkedLearners} learners linked across ${orgs.length} org(s).`,
    );
    process.exit(0);
  } catch (e) {
    console.error("Backfill failed:", e);
    process.exit(1);
  }
})();

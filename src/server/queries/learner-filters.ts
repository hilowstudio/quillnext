import { Prisma } from "@/generated/client";

/**
 * Excludes "parent-as-learner" rows from student-facing roster and count queries.
 *
 * A parent who uses "My Learning" (`enrollSelfInCourse`) gets a `Learner` linked to their PARENT
 * `Profile`; real students have a STUDENT `Profile` (or, for legacy/unlinked rows, none). Spreading
 * this fragment into a learner `where` keeps the row out of anything that presents or counts
 * students. (Q-05-006)
 *
 * `NOT: { profile: { is: ... } }` is deliberate: it drops ONLY rows whose linked profile is PARENT,
 * and PRESERVES learners whose `profile` is null (pre-backfill / unlinked students). A naive
 * `profile: { is: { type: "STUDENT" } }` would wrongly hide those null-profile learners.
 *
 * Do NOT apply this to the full data export (`data-export.ts` — data sovereignty: a parent's own
 * learner data must be exported) or to the parent's own "My Learning" view (`getMyLearning`, which
 * fetches the parent's learner by `profileId`, not an org roster).
 */
export const excludeParentLearners = {
  NOT: { profile: { is: { type: "PARENT" } } },
} satisfies Prisma.LearnerWhereInput;

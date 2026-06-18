"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUserOrg } from "@/lib/auth-helpers";
import { withTenant } from "@/server/db";
import { getActiveProfile } from "@/server/profiles/active-profile";
import { assertParentProfile } from "@/server/profiles/guards";

export type EnrollResult = { ok: true } | { ok: false; error: string };

/**
 * Enroll the active PARENT profile in a course ("My Learning"). Lazily creates the profile's
 * Learner the first time (adult learner — no birthdate/grade/safety/personality), then idempotently
 * creates the CourseStudent enrollment. PARENT-only; org-scoped. Purely additive — never touches
 * the parent's powers.
 */
export async function enrollSelfInCourse(courseId: string): Promise<EnrollResult> {
  await assertParentProfile();
  const active = await getActiveProfile();
  if (!active) return { ok: false, error: "No active profile." };

  const { organizationId } = await getCurrentUserOrg();
  if (!organizationId) return { ok: false, error: "No organization." };

  const course = await withTenant(
    (tx) => tx.course.findUnique({ where: { id: courseId }, select: { id: true, organizationId: true } }),
    undefined,
    { organizationId, userId: null },
  );
  if (!course || course.organizationId !== organizationId) return { ok: false, error: "Course not found." };

  await withTenant(
    async (tx) => {
      let learner = await tx.learner.findUnique({ where: { profileId: active.id }, select: { id: true } });
      if (!learner) {
        learner = await tx.learner.create({
          data: {
            organizationId,
            profileId: active.id,
            firstName: active.displayName,
            avatarConfig: active.avatarConfig ?? undefined,
          },
          select: { id: true },
        });
      }

      const existing = await tx.courseStudent.findUnique({
        where: { courseId_studentId: { courseId, studentId: learner.id } },
        select: { courseId: true },
      });
      if (!existing) {
        await tx.courseStudent.create({ data: { courseId, studentId: learner.id, status: "ACTIVE" } });
      }
    },
    undefined,
    { organizationId, userId: null },
  );

  revalidatePath("/");
  return { ok: true };
}

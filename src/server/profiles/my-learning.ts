import "server-only";
import { cache } from "react";
import { withTenant } from "@/server/db";

export type MyLearningEnrollment = { courseId: string; title: string; subjectName: string | null; status: string };
export type MyLearningCourse = { id: string; title: string; subjectName: string | null };
export type MyLearning = {
  learnerId: string | null;
  enrollments: MyLearningEnrollment[];
  availableCourses: MyLearningCourse[];
};

/**
 * "My Learning" data for a PARENT profile: the Learner attached to this profile (if any), its
 * course enrollments, and the org courses it is NOT yet enrolled in. org-scoped.
 */
export const getMyLearning = cache(async (profileId: string, organizationId: string): Promise<MyLearning> => {
  return withTenant(
    async (tx) => {
      const learner = await tx.learner.findUnique({
        where: { profileId },
        select: {
          id: true,
          courseEnrollments: {
            select: {
              status: true,
              course: { select: { id: true, title: true, subject: { select: { name: true } } } },
            },
          },
        },
      });

      const enrollments: MyLearningEnrollment[] = (learner?.courseEnrollments ?? []).map((e) => ({
        courseId: e.course.id,
        title: e.course.title,
        subjectName: e.course.subject?.name ?? null,
        status: e.status,
      }));
      const enrolledIds = new Set(enrollments.map((e) => e.courseId));

      const courses = await tx.course.findMany({
        where: { organizationId },
        select: { id: true, title: true, subject: { select: { name: true } } },
        orderBy: { title: "asc" },
      });
      const availableCourses: MyLearningCourse[] = courses
        .filter((c) => !enrolledIds.has(c.id))
        .map((c) => ({ id: c.id, title: c.title, subjectName: c.subject?.name ?? null }));

      return { learnerId: learner?.id ?? null, enrollments, availableCourses };
    },
    undefined,
    { organizationId, userId: null },
  );
});

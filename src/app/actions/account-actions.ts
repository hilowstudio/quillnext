"use server";

import { db, withTenant } from "@/server/db";
import { auth } from "@/auth";
import { setRlsContext } from "@/server/rls-context";
import { revalidatePath } from "next/cache";

export async function deactivateAccount() {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Unauthorized" };
  }

  await db.user.update({
    where: { id: session.user.id },
    data: { deactivatedAt: new Date() },
  });

  revalidatePath("/");
  return { success: true };
}

export async function reactivateAccount() {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Unauthorized" };
  }

  await db.user.update({
    where: { id: session.user.id },
    data: { deactivatedAt: null },
  });

  revalidatePath("/");
  return { success: true };
}

export async function deleteAccount() {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Unauthorized" };
  }

  const userId = session.user.id;

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { organizationId: true, role: true },
  });

  const orgId = user?.organizationId;

  // RLS: deleteAccount uses auth() directly (not getCurrentUserOrg), so set the tenant context
  // explicitly for the deletion transaction below.
  setRlsContext({ organizationId: orgId ?? null, userId });

  // ROLE GATE: deleting an account cascades to the ENTIRE Organization
  // (User.organization is onDelete: Cascade — every user/student/course/transcript/library
  // item in the family is destroyed). In a multi-member org, only the OWNER may do this;
  // otherwise any member could wipe everyone else's data.
  if (orgId) {
    const memberCount = await db.user.count({ where: { organizationId: orgId } });
    if (memberCount > 1 && user?.role !== "OWNER") {
      return {
        success: false,
        error:
          "Only the organization owner can delete the account — this permanently removes the whole family's data. Ask an owner, or remove other members first.",
      };
    }
  }

  // ATOMIC: one transaction so a mid-way failure can never leave a half-deleted tenant.
  await withTenant(
    async (tx) => {
      // Nullify grader references (optional FK — don't cascade, just clear)
      await tx.assessmentAttempt.updateMany({
        where: { graderUserId: userId },
        data: { graderUserId: null },
      });

      // Delete resources created by user
      await tx.resourceAssignment.deleteMany({
        where: { assignedByUserId: userId },
      });
      await tx.resource.deleteMany({
        where: { createdByUserId: userId },
      });

      if (orgId) {
        // Students cascade their nested data (progress, attempts, etc.)
        await tx.learner.deleteMany({ where: { organizationId: orgId } });

        // Transcripts
        await tx.transcript.deleteMany({ where: { organizationId: orgId } });

        // Courses — delete bottom-up to respect FK constraints
        const courses = await tx.course.findMany({
          where: { organizationId: orgId },
          select: { id: true },
        });
        const courseIds = courses.map((c: { id: string }) => c.id);

        if (courseIds.length > 0) {
          await tx.assessmentItemResponse.deleteMany({
            where: { attempt: { assessment: { courseId: { in: courseIds } } } },
          });
          await tx.assessmentAttempt.deleteMany({
            where: { assessment: { courseId: { in: courseIds } } },
          });
          await tx.assessmentItem.deleteMany({
            where: { assessment: { courseId: { in: courseIds } } },
          });
          await tx.assessment.deleteMany({
            where: { courseId: { in: courseIds } },
          });

          await tx.activityProgress.deleteMany({
            where: { activity: { courseBlock: { courseId: { in: courseIds } } } },
          });
          await tx.resourceAssignment.deleteMany({
            where: { activity: { courseBlock: { courseId: { in: courseIds } } } },
          });
          await tx.activity.deleteMany({
            where: { courseBlock: { courseId: { in: courseIds } } },
          });

          await tx.courseBlock.deleteMany({
            where: { courseId: { in: courseIds } },
          });
          await tx.courseProgress.deleteMany({
            where: { courseId: { in: courseIds } },
          });
          await tx.course.deleteMany({ where: { id: { in: courseIds } } });
        }

        // Library items
        await tx.book.deleteMany({ where: { organizationId: orgId } });
        await tx.videoResource.deleteMany({ where: { organizationId: orgId } });
        await tx.article.deleteMany({ where: { organizationId: orgId } });
        await tx.documentResource.deleteMany({ where: { organizationId: orgId } });

        // Classrooms
        await tx.classroomInstructor.deleteMany({
          where: { classroom: { organizationId: orgId } },
        });
        await tx.classroom.deleteMany({ where: { organizationId: orgId } });

        // Org-wide resources + their assignments. These reference users via RESTRICT FKs
        // (resources.created_by_user_id, resource_assignments.assigned_by_user_id) and are NOT
        // covered by the course/library deletes above, so a resource authored by ANOTHER member
        // would block the users cascade below and roll the whole transaction back. Delete them
        // org-wide first. (resource_assignments.resource_id is ON DELETE CASCADE, so deleting the
        // resources clears their assignments; we also delete assignments authored by org members
        // directly, to be safe against any cross-org resource reference.)
        await tx.resourceAssignment.deleteMany({
          where: {
            OR: [
              { resource: { organizationId: orgId } },
              { assignedByUser: { organizationId: orgId } },
            ],
          },
        });
        await tx.resource.deleteMany({ where: { organizationId: orgId } });

        // Deleting the organization cascades to its users (User.organization onDelete: Cascade)
        // — this user and their personal discipleship data go with it — so there is no separate
        // user.delete in the org path (that would target an already-removed row).
        await tx.organization.delete({ where: { id: orgId } });
      } else {
        // No org: delete just this user (cascades accounts, sessions, prayer entries,
        // bible memory, devotional reflections, church notes, gratitude journal).
        await tx.user.delete({ where: { id: userId } });
      }
    },
    { timeout: 30000 },
  );

  return { success: true };
}

export async function transferOwnership(newOwnerUserId: string) {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Unauthorized" };
  }

  const currentUser = await db.user.findUnique({
    where: { id: session.user.id },
    select: { role: true, organizationId: true },
  });

  if (currentUser?.role !== "OWNER") {
    return {
      success: false,
      error: "Only the organization owner can transfer ownership",
    };
  }

  if (!currentUser.organizationId) {
    return { success: false, error: "No organization found" };
  }

  const newOwner = await db.user.findUnique({
    where: { id: newOwnerUserId },
    select: { organizationId: true },
  });

  if (newOwner?.organizationId !== currentUser.organizationId) {
    return {
      success: false,
      error: "User is not a member of your organization",
    };
  }

  await db.user.update({
    where: { id: newOwnerUserId },
    data: { role: "OWNER" },
  });
  await db.user.update({
    where: { id: session.user.id },
    data: { role: "PARENT" },
  });

  revalidatePath("/");
  return { success: true };
}

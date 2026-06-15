"use server";

import { db } from "@/server/db";
import { auth } from "@/auth";
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
    select: { organizationId: true },
  });

  const orgId = user?.organizationId;

  // Nullify grader references (optional FK — don't cascade, just clear)
  await db.assessmentAttempt.updateMany({
    where: { graderUserId: userId },
    data: { graderUserId: null },
  });

  // Delete resources created by user
  await db.resourceAssignment.deleteMany({
    where: { assignedByUserId: userId },
  });
  await db.resource.deleteMany({
    where: { createdByUserId: userId },
  });

  if (orgId) {
    // Students cascade their nested data (progress, attempts, etc.)
    await db.student.deleteMany({ where: { organizationId: orgId } });

    // Transcripts
    await db.transcript.deleteMany({ where: { organizationId: orgId } });

    // Courses — delete bottom-up to respect FK constraints
    // Assessment items/attempts reference assessments which reference courses
    const courses = await db.course.findMany({
      where: { organizationId: orgId },
      select: { id: true },
    });
    const courseIds = courses.map((c: { id: string }) => c.id);

    if (courseIds.length > 0) {
      // Delete assessment data
      await db.assessmentItemResponse.deleteMany({
        where: { attempt: { assessment: { courseId: { in: courseIds } } } },
      });
      await db.assessmentAttempt.deleteMany({
        where: { assessment: { courseId: { in: courseIds } } },
      });
      await db.assessmentItem.deleteMany({
        where: { assessment: { courseId: { in: courseIds } } },
      });
      await db.assessment.deleteMany({
        where: { courseId: { in: courseIds } },
      });

      // Delete activity data
      await db.activityProgress.deleteMany({
        where: { activity: { courseBlock: { courseId: { in: courseIds } } } },
      });
      await db.resourceAssignment.deleteMany({
        where: { activity: { courseBlock: { courseId: { in: courseIds } } } },
      });
      await db.activity.deleteMany({
        where: { courseBlock: { courseId: { in: courseIds } } },
      });

      // Delete blocks and courses
      await db.courseBlock.deleteMany({
        where: { courseId: { in: courseIds } },
      });
      await db.courseProgress.deleteMany({
        where: { courseId: { in: courseIds } },
      });
      await db.course.deleteMany({ where: { id: { in: courseIds } } });
    }

    // Library items
    await db.book.deleteMany({ where: { organizationId: orgId } });
    await db.videoResource.deleteMany({ where: { organizationId: orgId } });
    await db.article.deleteMany({ where: { organizationId: orgId } });
    await db.documentResource.deleteMany({ where: { organizationId: orgId } });

    // Classrooms
    await db.classroomInstructor.deleteMany({
      where: { classroom: { organizationId: orgId } },
    });
    await db.classroom.deleteMany({ where: { organizationId: orgId } });

    // Organization
    await db.organization.delete({ where: { id: orgId } });
  }

  // Delete user (cascades: accounts, sessions, prayer entries, bible memory,
  // devotional reflections, church notes, gratitude journal)
  await db.user.delete({ where: { id: userId } });

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

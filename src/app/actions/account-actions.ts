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

  // Delete all user-related data explicitly to handle relations
  // without onDelete: Cascade. Order matters for foreign key constraints.
  await db.$transaction(async (tx) => {
    // Delete resources created by user
    await tx.resourceAssignment.deleteMany({
      where: { assignedByUserId: userId },
    });
    await tx.resource.deleteMany({
      where: { createdByUserId: userId },
    });

    // Nullify grader references (optional FK — don't cascade, just clear)
    await tx.assessmentAttempt.updateMany({
      where: { graderUserId: userId },
      data: { graderUserId: null },
    });

    // Delete org-scoped data if user owns the org
    if (orgId) {
      // Delete students and all their cascading data (handled by Prisma schema)
      await tx.student.deleteMany({
        where: { organizationId: orgId },
      });

      // Delete transcripts
      await tx.transcriptEntry.deleteMany({
        where: { transcript: { organizationId: orgId } },
      });
      await tx.transcript.deleteMany({
        where: { organizationId: orgId },
      });

      // Delete courses and nested structure
      // Activities, blocks, assessments cascade from course
      const courseIds = (
        await tx.course.findMany({
          where: { organizationId: orgId },
          select: { id: true },
        })
      ).map((c) => c.id);

      if (courseIds.length > 0) {
        const blockIds = (
          await tx.courseBlock.findMany({
            where: { courseId: { in: courseIds } },
            select: { id: true },
          })
        ).map((b) => b.id);

        if (blockIds.length > 0) {
          const activityIds = (
            await tx.activity.findMany({
              where: { blockId: { in: blockIds } },
              select: { id: true },
            })
          ).map((a) => a.id);

          if (activityIds.length > 0) {
            await tx.assessmentItemResponse.deleteMany({
              where: {
                attempt: { activityId: { in: activityIds } },
              },
            });
            await tx.assessmentAttempt.deleteMany({
              where: { activityId: { in: activityIds } },
            });
            await tx.activityProgress.deleteMany({
              where: { activityId: { in: activityIds } },
            });
            await tx.assessmentItem.deleteMany({
              where: { assessment: { activityId: { in: activityIds } } },
            });
            await tx.assessment.deleteMany({
              where: { activityId: { in: activityIds } },
            });
            await tx.resourceAssignment.deleteMany({
              where: { activityId: { in: activityIds } },
            });
            await tx.activity.deleteMany({
              where: { id: { in: activityIds } },
            });
          }

          await tx.courseBlock.deleteMany({
            where: { id: { in: blockIds } },
          });
        }

        await tx.courseProgress.deleteMany({
          where: { courseId: { in: courseIds } },
        });
        await tx.course.deleteMany({
          where: { id: { in: courseIds } },
        });
      }

      // Delete library items
      await tx.book.deleteMany({ where: { organizationId: orgId } });
      await tx.videoResource.deleteMany({ where: { organizationId: orgId } });
      await tx.article.deleteMany({ where: { organizationId: orgId } });
      await tx.documentResource.deleteMany({
        where: { organizationId: orgId },
      });

      // Delete classrooms
      await tx.classroomInstructor.deleteMany({
        where: { classroom: { organizationId: orgId } },
      });
      await tx.classroom.deleteMany({ where: { organizationId: orgId } });

      // Delete organization
      await tx.organization.delete({ where: { id: orgId } });
    }

    // Delete user (cascades: accounts, sessions, prayer entries, bible memory,
    // devotional reflections, church notes, gratitude journal)
    await tx.user.delete({ where: { id: userId } });
  });

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
    return { success: false, error: "Only the organization owner can transfer ownership" };
  }

  if (!currentUser.organizationId) {
    return { success: false, error: "No organization found" };
  }

  // Verify new owner is in the same org
  const newOwner = await db.user.findUnique({
    where: { id: newOwnerUserId },
    select: { organizationId: true },
  });

  if (newOwner?.organizationId !== currentUser.organizationId) {
    return { success: false, error: "User is not a member of your organization" };
  }

  await db.$transaction([
    db.user.update({
      where: { id: newOwnerUserId },
      data: { role: "OWNER" },
    }),
    db.user.update({
      where: { id: session.user.id },
      data: { role: "PARENT" },
    }),
  ]);

  revalidatePath("/");
  return { success: true };
}

"use server";

import { db } from "@/server/db";
import { auth } from "@/auth";

export async function exportUserData() {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Unauthorized" };
  }

  const userId = session.user.id;

  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      name: true,
      email: true,
      role: true,
      createdAt: true,
      updatedAt: true,
      organization: {
        select: {
          name: true,
          createdAt: true,
        },
      },
    },
  });

  if (!user) {
    return { success: false, error: "User not found" };
  }

  const orgId = (
    await db.user.findUnique({
      where: { id: userId },
      select: { organizationId: true },
    })
  )?.organizationId;

  // Fetch all user-owned and org-related data in parallel
  const [
    students,
    courses,
    books,
    videos,
    articles,
    documents,
    prayerEntries,
    bibleMemory,
    devotionalReflections,
    churchNotes,
    gratitudeEntries,
    transcripts,
    classrooms,
    resources,
  ] = await Promise.all([
    // Students with all nested data
    db.student.findMany({
      where: { organizationId: orgId ?? undefined },
      include: {
        learnerProfile: true,
        courseProgress: {
          include: { activityProgress: true },
        },
        assessmentAttempts: true,
        courseEnrollments: {
          select: { courseId: true },
        },
      },
    }),

    // Courses with structure
    db.course.findMany({
      where: { organizationId: orgId ?? undefined },
      include: {
        blocks: {
          include: {
            activities: {
              include: {
                assessments: true,
              },
            },
          },
        },
      },
    }),

    // Library resources
    db.book.findMany({
      where: { organizationId: orgId ?? undefined },
    }),
    db.videoResource.findMany({
      where: { organizationId: orgId ?? undefined },
    }),
    db.article.findMany({
      where: { organizationId: orgId ?? undefined },
    }),
    db.documentResource.findMany({
      where: { organizationId: orgId ?? undefined },
    }),

    // Discipleship data
    db.prayerJournalEntry.findMany({
      where: { userId },
    }),
    db.bibleMemory.findMany({
      where: { userId },
    }),
    db.devotionalReflection.findMany({
      where: { userId },
    }),
    db.localChurchNotes.findMany({
      where: { userId },
    }),
    db.gratitudeJournal.findMany({
      where: { userId },
    }),

    // Transcripts
    orgId
      ? db.transcript.findMany({
          where: { organizationId: orgId },
          include: { entries: true },
        })
      : Promise.resolve([]),

    // Classrooms / Blueprint
    orgId
      ? db.classroom.findMany({
          where: { organizationId: orgId },
          include: {
            instructors: true,
          },
        })
      : Promise.resolve([]),

    // Generated resources
    db.resource.findMany({
      where: { createdByUserId: userId },
    }),
  ]);

  const exportData = {
    exportDate: new Date().toISOString(),
    exportVersion: "1.0",
    user: {
      name: user.name,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    },
    organization: user.organization,
    students,
    courses,
    library: {
      books,
      videos,
      articles,
      documents,
    },
    discipleship: {
      prayerEntries,
      bibleMemory,
      devotionalReflections,
      churchNotes,
      gratitudeEntries,
    },
    transcripts,
    classrooms,
    generatedResources: resources,
  };

  return { success: true, data: exportData };
}

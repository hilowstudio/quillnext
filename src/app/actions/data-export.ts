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
      organizationId: true,
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

  // SECURITY: when the user has no org, NEVER run an org-scoped findMany. In Prisma a
  // `{ organizationId: undefined }` filter is DROPPED, which would match EVERY tenant's rows
  // (a cross-tenant leak in a data-export surface). Org-scoped queries run only for a real id.
  const orgId = user.organizationId;

  // User-scoped data — always exportable.
  const [
    prayerEntries,
    bibleMemory,
    devotionalReflections,
    churchNotes,
    gratitudeEntries,
    resources,
  ] = await Promise.all([
    db.prayerJournalEntry.findMany({ where: { userId } }),
    db.bibleMemory.findMany({ where: { userId } }),
    db.devotionalReflection.findMany({ where: { userId } }),
    db.localChurchNotes.findMany({ where: { userId } }),
    db.gratitudeJournal.findMany({ where: { userId } }),
    db.resource.findMany({ where: { createdByUserId: userId } }),
  ]);

  // Org-scoped data — only when the user actually belongs to an org.
  const [
    students,
    courses,
    books,
    videos,
    articles,
    documents,
    transcripts,
    classrooms,
  ] = await Promise.all([
    orgId
      ? db.student.findMany({
          where: { organizationId: orgId },
          include: {
            learnerProfile: true,
            courseProgress: true,
            courseEnrollments: { select: { courseId: true } },
          },
        })
      : Promise.resolve([]),
    orgId
      ? db.course.findMany({
          where: { organizationId: orgId },
          include: { blocks: { include: { activities: true } } },
        })
      : Promise.resolve([]),
    orgId ? db.book.findMany({ where: { organizationId: orgId } }) : Promise.resolve([]),
    orgId ? db.videoResource.findMany({ where: { organizationId: orgId } }) : Promise.resolve([]),
    orgId ? db.article.findMany({ where: { organizationId: orgId } }) : Promise.resolve([]),
    orgId
      ? db.documentResource.findMany({ where: { organizationId: orgId } })
      : Promise.resolve([]),
    orgId ? db.transcript.findMany({ where: { organizationId: orgId } }) : Promise.resolve([]),
    orgId
      ? db.classroom.findMany({
          where: { organizationId: orgId },
          include: { instructors: true },
        })
      : Promise.resolve([]),
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

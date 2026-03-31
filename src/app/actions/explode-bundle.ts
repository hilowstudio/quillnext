"use server";

import { auth } from "@/auth";
import { getCurrentUserOrg } from "@/lib/auth-helpers";
import { db } from "@/server/db";
import { revalidatePath } from "next/cache";

export async function explodeCurriculumBundle(bundleId: string, courseId: string) {
    const session = await auth();
    if (!session?.user?.id) throw new Error("Unauthorized");

    const { organizationId } = await getCurrentUserOrg();
    if (!organizationId) throw new Error("No organization found");

    // 1. Fetch Bundle and Resources
    const bundle = await db.curriculumBundle.findUnique({
        where: { id: bundleId },
        include: {
            spec: true,
            resources: {
                include: {
                    resourceKind: true,
                    book: true,
                    video: true,
                    article: true,
                    document: true,
                }
            },
        },
    });

    if (!bundle) throw new Error("Bundle not found");
    if (bundle.status !== "COMPLETED") throw new Error("Bundle must be COMPLETED to explode");

    // 2. Identify Key Resources
    const tg = bundle.resources.find(r => r.resourceKind.code === "TEACHER_GUIDE");
    const sp = bundle.resources.find(r => r.resourceKind.code === "STUDENT_PACKET");
    const slides = bundle.resources.find(r => r.resourceKind.code === "SLIDES");
    const ra = bundle.resources.find(r => r.resourceKind.code === "READING_ANTHOLOGY");
    // const organizers = bundle.resources.find(r => r.resourceKind.code === "ORGANIZERS");

    // 3. Create Unit Block
    const maxPos = await db.courseBlock.findFirst({
        where: { courseId, parentBlockId: null },
        orderBy: { position: "desc" },
    });
    const nextPos = (maxPos?.position ?? -1) + 1;

    const unitBlock = await db.courseBlock.create({
        data: {
            courseId,
            kind: "UNIT",
            title: bundle.spec.title,
            position: nextPos,
            sourceBundleId: bundle.id,
        },
    });

    // 4. Create Lessons (Loop durationDays)
    const duration = bundle.spec.durationDays || 1;
    for (let i = 1; i <= duration; i++) {
        const lesson = await db.courseBlock.create({
            data: {
                courseId,
                parentBlockId: unitBlock.id,
                kind: "LESSON",
                title: `Day ${i}: ${bundle.spec.topic}`,
                position: i - 1,
                sourceBundleId: bundle.id,
                // Attach Resources
                bookId: tg?.book?.id, // Teacher Guide as Book (if applicable)
                documentId: sp?.document?.id, // Student Packet as Document
                // Video? Slides usually come as Resource/Video
                // If slides are a video or generic resource:
                videoId: slides?.video?.id,
                resourceId: (!slides?.video?.id && slides?.id) ? slides.id : undefined,

                // For Day 1, attach Anthology if exists
                // Note: CourseBlock only has 1 slot per type. 
                // If we have Anthology (Article) and SP (Document), they fit.
                // If we have multiple Docs, we need logic. 
                // Assuming RA is Article or Document.
                articleId: (i === 1 && ra?.article?.id) ? ra.article.id : undefined,
            },
        });
    }

    revalidatePath(`/courses/${courseId}`);
    return { success: true, unitId: unitBlock.id };
}

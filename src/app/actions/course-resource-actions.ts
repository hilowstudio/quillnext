"use server";

import { db as prisma } from "@/server/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentUserOrg } from "@/lib/auth-helpers";

const attachBookSchema = z.object({
    blockId: z.string().uuid(),
    bookId: z.string().uuid(),
    courseId: z.string().uuid(),
});

const attachVideoSchema = z.object({
    blockId: z.string().uuid(),
    videoId: z.string().uuid(),
    courseId: z.string().uuid(),
});

const attachArticleSchema = z.object({
    blockId: z.string().uuid(),
    articleId: z.string().uuid(),
    courseId: z.string().uuid(),
});

const attachDocumentSchema = z.object({
    blockId: z.string().uuid(),
    documentId: z.string().uuid(),
    courseId: z.string().uuid(),
});

const detachResourceSchema = z.object({
    blockId: z.string().uuid(),
    resourceType: z.enum(["BOOK", "VIDEO", "ARTICLE", "DOCUMENT", "RESOURCE"]),
    courseId: z.string().uuid(),
});

// --- Authorization guards ---
// These actions mutate a CourseBlock and attach a library resource. Both the
// block (via its course) and the resource being attached must belong to the
// caller's organization, or any logged-in user could edit another org's course.

async function requireOrg() {
    const { organizationId } = await getCurrentUserOrg(); // throws if unauthenticated
    if (!organizationId) throw new Error("No organization found");
    return organizationId;
}

async function assertBlockInOrg(blockId: string, organizationId: string) {
    const block = await prisma.courseBlock.findUnique({
        where: { id: blockId },
        select: { course: { select: { organizationId: true } } },
    });
    if (!block || block.course.organizationId !== organizationId) throw new Error("Unauthorized");
}

export async function attachBookToBlock(rawData: unknown) {
    const data = attachBookSchema.parse(rawData);
    const organizationId = await requireOrg();
    await assertBlockInOrg(data.blockId, organizationId);

    const book = await prisma.book.findUnique({ where: { id: data.bookId }, select: { organizationId: true } });
    if (!book || book.organizationId !== organizationId) throw new Error("Unauthorized");

    await prisma.courseBlock.update({
        where: { id: data.blockId },
        data: { bookId: data.bookId },
    });
    revalidatePath(`/courses/${data.courseId}/builder`);
    return { success: true };
}

export async function attachVideoToBlock(rawData: unknown) {
    const data = attachVideoSchema.parse(rawData);
    const organizationId = await requireOrg();
    await assertBlockInOrg(data.blockId, organizationId);

    const video = await prisma.videoResource.findUnique({ where: { id: data.videoId }, select: { organizationId: true } });
    if (!video || video.organizationId !== organizationId) throw new Error("Unauthorized");

    await prisma.courseBlock.update({
        where: { id: data.blockId },
        data: { videoId: data.videoId },
    });
    revalidatePath(`/courses/${data.courseId}/builder`);
    return { success: true };
}

export async function attachArticleToBlock(rawData: unknown) {
    const data = attachArticleSchema.parse(rawData);
    const organizationId = await requireOrg();
    await assertBlockInOrg(data.blockId, organizationId);

    const article = await prisma.article.findUnique({ where: { id: data.articleId }, select: { organizationId: true } });
    if (!article || article.organizationId !== organizationId) throw new Error("Unauthorized");

    await prisma.courseBlock.update({
        where: { id: data.blockId },
        data: { articleId: data.articleId },
    });
    revalidatePath(`/courses/${data.courseId}/builder`);
    return { success: true };
}

export async function attachDocumentToBlock(rawData: unknown) {
    const data = attachDocumentSchema.parse(rawData);
    const organizationId = await requireOrg();
    await assertBlockInOrg(data.blockId, organizationId);

    const doc = await prisma.documentResource.findUnique({ where: { id: data.documentId }, select: { organizationId: true } });
    if (!doc || doc.organizationId !== organizationId) throw new Error("Unauthorized");

    await prisma.courseBlock.update({
        where: { id: data.blockId },
        data: { documentId: data.documentId },
    });
    revalidatePath(`/courses/${data.courseId}/builder`);
    return { success: true };
}

export async function detachResourceFromBlock(rawData: unknown) {
    const data = detachResourceSchema.parse(rawData);
    const organizationId = await requireOrg();
    await assertBlockInOrg(data.blockId, organizationId);

    await prisma.courseBlock.update({
        where: { id: data.blockId },
        data: {
            bookId: data.resourceType === "BOOK" ? null : undefined,
            videoId: data.resourceType === "VIDEO" ? null : undefined,
            articleId: data.resourceType === "ARTICLE" ? null : undefined,
            documentId: data.resourceType === "DOCUMENT" ? null : undefined,
            resourceId: data.resourceType === "RESOURCE" ? null : undefined,
        },
    });
    revalidatePath(`/courses/${data.courseId}/builder`);
    return { success: true };
}

const attachResourceSchema = z.object({
    blockId: z.string().uuid(),
    resourceId: z.string().uuid(),
    courseId: z.string().uuid(),
});

export async function attachResourceToBlock(rawData: unknown) {
    const data = attachResourceSchema.parse(rawData);
    const organizationId = await requireOrg();
    await assertBlockInOrg(data.blockId, organizationId);

    const resource = await prisma.resource.findUnique({ where: { id: data.resourceId }, select: { organizationId: true } });
    if (!resource || resource.organizationId !== organizationId) throw new Error("Unauthorized");

    await prisma.courseBlock.update({
        where: { id: data.blockId },
        data: { resourceId: data.resourceId },
    });
    revalidatePath(`/courses/${data.courseId}/builder`);
    return { success: true };
}

"use server";

import { auth } from "@/auth";
import { getCurrentUserOrg } from "@/lib/auth-helpers";
import { db } from "@/server/db";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { deleteBlockSchema, updateBlockSchema, deleteCourseSchema } from "@/lib/schemas/actions";

const ReorderSchema = z.array(
    z.object({
        id: z.string(),
        position: z.number(),
        parentBlockId: z.string().nullable(),
    })
);

export async function reorderBlocks(
    courseId: string,
    updates: z.infer<typeof ReorderSchema>
) {
    const session = await auth();
    if (!session?.user) {
        throw new Error("Unauthorized");
    }

    const { organizationId } = await getCurrentUserOrg();
    if (!organizationId) {
        throw new Error("Unauthorized");
    }

    // Validate the payload (ReorderSchema was previously declared but never parsed).
    const safeUpdates = ReorderSchema.parse(updates);

    // Verify the caller owns the course.
    const course = await db.course.findFirst({
        where: { id: courseId, organizationId },
        select: { id: true },
    });

    if (!course) {
        throw new Error("Course not found or unauthorized");
    }

    // SECURITY: you may only reorder/re-parent blocks that belong to THIS course. Reject any
    // foreign block id (and any cross-course parentBlockId) before writing — otherwise a crafted
    // drag-save payload could reposition/re-parent another org's blocks.
    const ownBlocks = await db.courseBlock.findMany({
        where: { courseId },
        select: { id: true },
    });
    const ownBlockIds = new Set(ownBlocks.map((b) => b.id));

    for (const u of safeUpdates) {
        if (!ownBlockIds.has(u.id)) {
            throw new Error("Cannot reorder a block that does not belong to this course");
        }
        if (u.parentBlockId !== null && !ownBlockIds.has(u.parentBlockId)) {
            throw new Error("Cannot set a parent block from a different course");
        }
    }

    // Each write is additionally scoped by courseId, so a foreign block id matches zero rows.
    await db.$transaction(
        safeUpdates.map((update) =>
            db.courseBlock.updateMany({
                where: { id: update.id, courseId },
                data: {
                    position: update.position,
                    parentBlockId: update.parentBlockId,
                },
            })
        )
    );

    revalidatePath(`/courses/${courseId}/builder`);
    return { success: true };
}

export async function deleteBlock(rawData: unknown) {
    const data = deleteBlockSchema.parse(rawData);

    const session = await auth();
    if (!session?.user) throw new Error("Not authenticated");

    const { organizationId } = await getCurrentUserOrg();

    const block = await db.courseBlock.findUnique({
        where: { id: data.id },
        select: {
            id: true,
            course: {
                select: {
                    organizationId: true,
                },
            },
        },
    });

    if (!block) {
        throw new Error("Block not found");
    }

    if (block.course.organizationId !== organizationId) {
        throw new Error("Unauthorized - block belongs to different organization");
    }

    await db.courseBlock.delete({
        where: { id: data.id },
    });

    revalidatePath(`/courses/${data.courseId}/builder`);
    return { success: true };
}

import { CourseBlockKind } from "@/generated/client";

// ... existing code ...

export async function updateBlock(rawData: unknown) {
    const data = updateBlockSchema.parse(rawData);

    const session = await auth();
    if (!session?.user) throw new Error("Not authenticated");

    const { organizationId } = await getCurrentUserOrg();

    const block = await db.courseBlock.findUnique({
        where: { id: data.id },
        select: {
            id: true,
            course: {
                select: {
                    organizationId: true,
                },
            },
        },
    });

    if (!block) {
        throw new Error("Block not found");
    }

    if (block.course.organizationId !== organizationId) {
        throw new Error("Unauthorized - block belongs to different organization");
    }

    await db.courseBlock.update({
        where: { id: data.id },
        data: {
            title: data.title,
            kind: data.kind as any, // Type cast needed for dynamic kind value
        },
    });

    revalidatePath(`/courses/${data.courseId}/builder`);
    return { success: true };
}

export async function deleteCourse(rawData: unknown) {
    const data = deleteCourseSchema.parse(rawData);

    const session = await auth();
    if (!session?.user) {
        throw new Error("Not authenticated");
    }

    const { organizationId } = await getCurrentUserOrg();

    // Verify course belongs to organization
    const course = await db.course.findUnique({
        where: { id: data.id },
    });

    if (!course) {
        throw new Error("Course not found");
    }

    if (course.organizationId !== organizationId) {
        throw new Error("Unauthorized - course belongs to different organization");
    }

    await db.course.delete({
        where: { id: data.id },
    });

    // Revalidate library and courses page
    revalidatePath("/living-library");
    revalidatePath("/courses-old"); // In case it's used
    return { success: true };
}

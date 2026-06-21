"use server";

import { auth } from "@/auth";
import { getCurrentUserOrg } from "@/lib/auth-helpers";
import { withTenant } from "@/server/db";
import { getMasterContext } from "@/lib/context/master-context";
import { serializeMasterContext } from "@/lib/context/context-serializer";
import { models } from "@/lib/ai/config";
import { generateObject } from "ai";
import { z } from "zod";
import { revalidatePath } from "next/cache";

import { Prisma } from "@/generated/client";

// Define strict type for the course structure we need
type CourseWithContext = Prisma.CourseGetPayload<{
    include: {
        blocks: {
            orderBy: { position: "desc" };
            take: 1;
        };
        subject: true;
        strand: true;
        gradeBand: true;
    };
}>;

export async function suggestCourseBlocks(courseId: string) {
    const session = await auth();
    if (!session?.user) throw new Error("Unauthorized");

    const { organizationId, userId } = await getCurrentUserOrg();
    if (!organizationId) throw new Error("No organization found");

    // 1. Verify course ownership & get current structure. Read through withTenant so the org GUC is
    // stamped when RLS is on (RLS-ready; a no-op pass-through tx today — db.ts:106-110). The explicit
    // app-layer org check below stays the LIVE boundary since withTenant adds no predicate with RLS
    // off (Q-10-003).
    const course = await withTenant(
        async (tx) => tx.course.findUnique({
            where: { id: courseId },
            include: {
                blocks: {
                    orderBy: { position: "desc" }, // Get last position
                    take: 1,
                },
                subject: true,
                strand: true,
                gradeBand: true,
            },
        }),
        undefined,
        { organizationId, userId },
    ) as unknown as CourseWithContext | null;

    if (!course || course.organizationId !== organizationId) {
        throw new Error("Course not found or unauthorized");
    }

    // 2. Prepare Context
    const masterContext = await getMasterContext({
        organizationId,
        courseId,
    });

    const serializedContext = serializeMasterContext(masterContext, {
        maxTokens: 4000,
        modelType: "flash",
    });

    // 3. Generate Suggestions
    const systemPrompt = `You are an expert curriculum designer.
Your task is to suggest a logical sequence of Units and Modules for this course.
Use the provided Master Context to align with the student's interests and the family's philosophy.
Ensure the structure follows the Academic Spine requirements.

Context:
${serializedContext}

Course Title: ${course.title}
Subject: ${course.subject.name}
${course.strand ? `Strand: ${course.strand.name}` : ""}
${course.gradeBand ? `Grade: ${course.gradeBand.name}` : ""}

Generate 3-5 high-quality blocks (Units or Modules).`;

    const { object } = await generateObject({
        model: models.flash,
        system: systemPrompt,
        prompt: "Generate a course structure outline.",
        schema: z.object({
            blocks: z.array(
                z.object({
                    title: z.string(),
                    kind: z.enum(["UNIT", "MODULE"]),
                    description: z.string().optional(),
                })
            ),
        }),
    });

    // 4. Save to DB — one withTenant tx so the suggested blocks land atomically (RLS-ready; a no-op
    // pass-through tx today). The AI call above runs OUTSIDE any tx: holding a multi-second
    // generateObject inside base.$transaction would pin the connection past Prisma's default timeout.
    const startPosition = (course.blocks[0]?.position ?? -1) + 1;
    const newBlocks = await withTenant(
        async (tx) => {
            const created = [];
            for (let i = 0; i < object.blocks.length; i++) {
                const suggestion = object.blocks[i];
                const block = await tx.courseBlock.create({
                    data: {
                        courseId,
                        title: suggestion.title,
                        kind: suggestion.kind,
                        description: suggestion.description,
                        position: startPosition + i,
                    },
                    include: {
                        activities: true, // Return empty array to match UI type
                    },
                });
                created.push(block);
            }
            return created;
        },
        undefined,
        { organizationId, userId },
    );

    revalidatePath(`/courses/${courseId}/builder`);
    return { success: true, blocks: newBlocks };
}

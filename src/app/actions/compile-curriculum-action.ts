"use server";

import { auth } from "@/auth";
import { getCurrentUserOrg } from "@/lib/auth-helpers";
import { db } from "@/server/db";
import { inngest } from "@/inngest/client";
import { revalidatePath } from "next/cache";

export async function compileCurriculumAction(data: {
    subject: string;
    topic: string;
    readingLevel: string;
    durationDays: number;
    constraints: any;
}) {
    const session = await auth();
    if (!session?.user?.id) throw new Error("Unauthorized");

    const { organizationId } = await getCurrentUserOrg();
    if (!organizationId) throw new Error("No organization found");

    // 1. Create Spec
    const spec = await db.curriculumSpec.create({
        data: {
            organizationId,
            title: `${data.subject}: ${data.topic}`,
            subject: data.subject,
            topic: data.topic,
            readingLevel: data.readingLevel,
            durationDays: data.durationDays,
            constraints: data.constraints,
        },
    });

    // 2. Create Bundle Shell
    const bundle = await db.curriculumBundle.create({
        data: {
            specId: spec.id,
            status: "COMPILING",
        },
    });

    // 3. Trigger Inngest Event
    await inngest.send({
        name: "curriculum/compile",
        data: {
            specId: spec.id,
            bundleId: bundle.id,
            organizationId,
            userId: session.user.id,
        },
    });

    revalidatePath("/creation-station");
    return { success: true, bundleId: bundle.id };
}

export async function patchCurriculumAction(parentBundleId: string, feedback: string) {
    const session = await auth();
    if (!session?.user?.id) throw new Error("Unauthorized");

    const { organizationId } = await getCurrentUserOrg();
    if (!organizationId) throw new Error("No organization found");

    // 1. Fetch Parent to verify & get Spec ID — and confirm it belongs to the caller's org.
    const parent = await db.curriculumBundle.findUnique({
        where: { id: parentBundleId },
        include: { spec: { select: { organizationId: true } } },
    });
    if (!parent) throw new Error("Parent bundle not found");
    if (parent.spec.organizationId !== organizationId) throw new Error("Unauthorized");

    // 2. Create Patch Bundle
    const bundle = await db.curriculumBundle.create({
        data: {
            specId: parent.specId,
            parentBundleId,
            feedback,
            status: "COMPILING",
        },
    });

    // 3. Trigger Inngest Event (Same event, just new Bundle ID)
    await inngest.send({
        name: "curriculum/compile",
        data: {
            specId: parent.specId,
            bundleId: bundle.id,
            organizationId,
            userId: session.user.id,
        },
    });

    revalidatePath("/creation-station");
    return { success: true, bundleId: bundle.id };
}

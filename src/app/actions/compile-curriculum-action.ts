"use server";

import { auth } from "@/auth";
import { getCurrentUserOrg } from "@/lib/auth-helpers";
import { withTenant } from "@/server/db";
import { inngest } from "@/inngest/client";
import { revalidatePath } from "next/cache";
import { curriculumSpecSchema } from "@/lib/validation/curriculum-spec";

export async function compileCurriculumAction(rawData: unknown) {
    const session = await auth();
    if (!session?.user?.id) throw new Error("Unauthorized");

    const { organizationId } = await getCurrentUserOrg();
    if (!organizationId) throw new Error("No organization found");

    // SECURITY: validate server-side. The client form schema is bypassable; durationDays in
    // particular MUST be bounded (it drives explode-bundle's per-day block creation).
    const data = curriculumSpecSchema.parse(rawData);

    // 1+2. Create Spec + Bundle Shell atomically through withTenant (RLS-ready: stamps the org GUC
    // when RLS is on; a no-op pass-through tx today since RLS is off — db.ts:106-110). One tx so a
    // spec can never be orphaned by a failed bundle create (Q-10-002). The Inngest send stays
    // OUTSIDE the tx — a network call must not hold the DB connection open, and the worker reads the
    // committed bundle asynchronously in its own request.
    const bundle = await withTenant(
        async (tx) => {
            const spec = await tx.curriculumSpec.create({
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
            return tx.curriculumBundle.create({
                data: {
                    specId: spec.id,
                    status: "COMPILING",
                },
            });
        },
        undefined,
        { organizationId, userId: session.user.id },
    );

    // 3. Trigger Inngest Event
    await inngest.send({
        name: "curriculum/compile",
        data: {
            specId: bundle.specId,
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

    // 1+2. Verify ownership and create the patch bundle in one withTenant tx (RLS-ready; a no-op
    // pass-through tx today). The explicit app-layer org check stays the LIVE boundary — withTenant
    // adds no predicate with RLS off (db.ts:106-110), so it must be retained; a throw rolls back
    // before any write (Q-10-002). Inngest send stays OUTSIDE the tx.
    const bundle = await withTenant(
        async (tx) => {
            // Fetch Parent to verify & get Spec ID — and confirm it belongs to the caller's org.
            const parent = await tx.curriculumBundle.findUnique({
                where: { id: parentBundleId },
                include: { spec: { select: { organizationId: true } } },
            });
            if (!parent) throw new Error("Parent bundle not found");
            if (parent.spec.organizationId !== organizationId) throw new Error("Unauthorized");

            return tx.curriculumBundle.create({
                data: {
                    specId: parent.specId,
                    parentBundleId,
                    feedback,
                    status: "COMPILING",
                },
            });
        },
        undefined,
        { organizationId, userId: session.user.id },
    );

    // 3. Trigger Inngest Event (Same event, just new Bundle ID)
    await inngest.send({
        name: "curriculum/compile",
        data: {
            specId: bundle.specId,
            bundleId: bundle.id,
            organizationId,
            userId: session.user.id,
        },
    });

    revalidatePath("/creation-station");
    return { success: true, bundleId: bundle.id };
}

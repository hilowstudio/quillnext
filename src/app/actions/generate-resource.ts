"use server";

import { auth } from "@/auth";
import { getCurrentUserOrg } from "@/lib/auth-helpers";
import { revalidatePath } from "next/cache";
import { generateResourceSchema } from "@/lib/schemas/actions";
import { generateResourceCore, type GenerateResourceCoreParams } from "./generate-resource-core";

/**
 * Browser-facing entry point (Server Action): authenticates the caller, resolves
 * their organization, then delegates to the session-less `generateResourceCore`.
 * Background jobs (the Inngest curriculum compiler) call `generateResourceCore`
 * directly with an org/user that was already verified when the job was enqueued.
 *
 * Signature is unchanged from the original positional form so existing callers
 * (Creation Station, etc.) work without modification. `additionalData` is forwarded
 * whole, so the Phase-2 `additionalData.sectionNumber` (book-chapter scoping) threads
 * straight through to `generateResourceCore`.
 */
export async function generateResource(
    sourceId: string,
    sourceType: GenerateResourceCoreParams["sourceType"],
    resourceKindId: string,
    instructions?: string,
    additionalData?: GenerateResourceCoreParams["additionalData"],
) {
    const session = await auth();
    if (!session?.user?.id) throw new Error("Unauthorized");

    const { organizationId } = await getCurrentUserOrg(session);
    if (!organizationId) throw new Error("No organization found");

    // Validate the browser-supplied request shape before it reaches the AI pipeline + DB
    // writes. This wrapper is the ONLY client-reachable generation entry — the Inngest
    // compiler calls generateResourceCore directly (compile-curriculum.ts:76-91), so trusted
    // background input is unaffected. Bounds instructions/fileContent (token cost) and
    // enum-checks sourceType (fail fast, not fail-slow on a paid model call). See Q-10-004
    // (docs/codebase-map/10-resource-generation-creation-station.md).
    const parsed = generateResourceSchema.safeParse({
        sourceId,
        sourceType,
        resourceKindId,
        instructions,
        additionalData,
    });
    if (!parsed.success) throw new Error("Invalid generation request");

    const result = await generateResourceCore({
        organizationId,
        userId: session.user.id,
        sourceId,
        sourceType,
        resourceKindId,
        instructions,
        additionalData,
    });

    revalidatePath("/living-library");
    return result;
}

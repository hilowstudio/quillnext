"use server";

import { auth } from "@/auth";
import { getCurrentUserOrg } from "@/lib/auth-helpers";
import { revalidatePath } from "next/cache";
import { generateResourceCore, type GenerateResourceCoreParams } from "./generate-resource-core";

/**
 * Browser-facing entry point (Server Action): authenticates the caller, resolves
 * their organization, then delegates to the session-less `generateResourceCore`.
 * Background jobs (the Inngest curriculum compiler) call `generateResourceCore`
 * directly with an org/user that was already verified when the job was enqueued.
 *
 * Signature is unchanged from the original positional form so existing callers
 * (Creation Station, etc.) work without modification.
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

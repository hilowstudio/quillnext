"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUserOrg } from "@/lib/auth-helpers";
import { assertParentProfile } from "@/server/profiles/guards";
import { withTenant } from "@/server/db";

/**
 * Mark a SafetyFlag as reviewed (Q-12-007 parent review UI). Parent-gated; org-scoped via the student
 * relation so a cross-org flagId updates zero rows (`updateMany` + the relation predicate, not a bare
 * `update` by id). Sets the existing `isResolved`/`resolvedAt` — no schema change.
 */
export async function markSafetyFlagReviewed(flagId: string): Promise<void> {
    await assertParentProfile();
    const { organizationId, userId } = await getCurrentUserOrg();
    if (!organizationId) throw new Error("No organization found");

    await withTenant(
        (tx) =>
            tx.safetyFlag.updateMany({
                where: { id: flagId, student: { organizationId } },
                data: { isResolved: true, resolvedAt: new Date() },
            }),
        undefined,
        { organizationId, userId },
    );

    revalidatePath("/safety");
}

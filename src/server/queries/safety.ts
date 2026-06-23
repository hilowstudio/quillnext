import "server-only";
import { withTenant } from "@/server/db";

/**
 * Org-scoped read of SafetyFlag rows for the parent review UI (Q-12-007). `SafetyFlag` has no direct
 * org column — it scopes through the student relation (mirrors the RLS policy). The stored `message` +
 * `reasoning` are ALREADY redacted at write-time for caregiver hard-stop flags (Q-12-009), so this read
 * surfaces exactly what is safe to show; no extra redaction is needed here. Unresolved flags first.
 */
export async function getSafetyFlags(organizationId: string) {
    return withTenant(
        (tx) =>
            tx.safetyFlag.findMany({
                where: { student: { organizationId } },
                select: {
                    id: true,
                    severity: true,
                    category: true,
                    message: true,
                    reasoning: true,
                    resolution: true,
                    implicatedCaregiver: true,
                    alertSent: true,
                    isResolved: true,
                    createdAt: true,
                    resolvedAt: true,
                    student: { select: { firstName: true, lastName: true, preferredName: true } },
                },
                orderBy: [{ isResolved: "asc" }, { createdAt: "desc" }],
            }),
        undefined,
        { organizationId, userId: null },
    );
}

export type SafetyFlagRow = Awaited<ReturnType<typeof getSafetyFlags>>[number];

import { redirect } from "next/navigation";
import { getCurrentUserOrg } from "@/lib/auth-helpers";
import { assertParentProfile } from "@/server/profiles/guards";
import { getSafetyFlags } from "@/server/queries/safety";
import { SafetyFlagList } from "@/components/safety/SafetyFlagList";

export const dynamic = "force-dynamic";

/**
 * Parent-facing SafetyFlag review (Q-12-007). Previously NO UI read SafetyFlag rows at all; this surfaces
 * them for review. Parent-gated (a STUDENT profile is redirected) + org-scoped. Content involving a
 * caregiver was redacted at write-time (Q-12-009), so this only ever shows what is safe to display.
 */
export default async function SafetyPage() {
    try {
        await assertParentProfile();
    } catch {
        redirect("/select-profile");
    }

    const { organizationId } = await getCurrentUserOrg();
    if (!organizationId) redirect("/select-profile");

    const flags = await getSafetyFlags(organizationId);

    return (
        <div className="container mx-auto max-w-4xl px-4 py-8 space-y-6">
            <div>
                <h1 className="font-display text-3xl font-bold text-qc-charcoal">Safety Review</h1>
                <p className="font-body text-qc-text-muted mt-1 qc-prose">
                    Safety signals detected during your students&apos; Thinkling chats. Concerns involving a
                    caregiver are redacted to protect the child; this page never notifies anyone.
                </p>
            </div>
            <SafetyFlagList flags={flags} />
        </div>
    );
}

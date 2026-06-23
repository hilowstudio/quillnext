"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { markSafetyFlagReviewed } from "@/app/actions/safety-flags";
import type { SafetyFlagRow } from "@/server/queries/safety";

function studentName(s: SafetyFlagRow["student"]): string {
    return `${s.preferredName || s.firstName} ${s.lastName || ""}`.trim();
}

// The internal [EVIDENCE:LEVEL] tag is for pattern-matching, not parents — strip it for display.
function displayReasoning(reasoning: string): string {
    return reasoning.replace(/^\[EVIDENCE:[^\]]*\]\s*/, "");
}

export function SafetyFlagList({ flags }: { flags: SafetyFlagRow[] }) {
    if (flags.length === 0) {
        return (
            <p className="font-body text-qc-text-muted">
                No safety flags. Nothing needs your attention right now.
            </p>
        );
    }
    return (
        <div className="space-y-4">
            {flags.map((f) => (
                <SafetyFlagCard key={f.id} flag={f} />
            ))}
        </div>
    );
}

function SafetyFlagCard({ flag }: { flag: SafetyFlagRow }) {
    const [pending, startTransition] = useTransition();
    const [resolved, setResolved] = useState(flag.isResolved);

    return (
        <Card className={resolved ? "opacity-60 border-qc-border-subtle" : "border-qc-border-subtle"}>
            <CardContent className="p-4 space-y-2">
                <div className="flex justify-between items-start gap-3">
                    <div>
                        <p className="font-body font-semibold text-qc-charcoal">{studentName(flag.student)}</p>
                        <p className="font-body text-sm text-qc-text-muted">
                            {flag.category} · {flag.severity} · {new Date(flag.createdAt).toLocaleString()}
                        </p>
                    </div>
                    {resolved ? (
                        <span className="font-body text-sm text-qc-text-muted">Reviewed</span>
                    ) : (
                        <Button
                            size="sm"
                            variant="outline"
                            disabled={pending}
                            onClick={() =>
                                startTransition(async () => {
                                    await markSafetyFlagReviewed(flag.id);
                                    setResolved(true);
                                })
                            }
                        >
                            {pending ? "Saving…" : "Mark reviewed"}
                        </Button>
                    )}
                </div>
                <p className="font-body text-sm text-qc-text-secondary">
                    <span className="font-medium">Resolution:</span> {flag.resolution ?? "—"}
                    {flag.implicatedCaregiver ? " · caregiver implicated" : ""}
                    {flag.alertSent ? " · alert sent" : ""}
                </p>
                <p className="font-body text-sm text-qc-text-secondary">
                    <span className="font-medium">Message:</span> {flag.message}
                </p>
                <p className="font-body text-sm text-qc-text-secondary">
                    <span className="font-medium">AI context:</span> {displayReasoning(flag.reasoning)}
                </p>
            </CardContent>
        </Card>
    );
}

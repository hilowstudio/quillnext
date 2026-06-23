"use client";

import { Lifebuoy, X } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { getCrisisResources } from "@/lib/safety/crisis-resources";
import type { SafetyAssessment } from "@/lib/safety/types";

interface CrisisHelpProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    category?: SafetyAssessment["category"];
}

/**
 * Child-facing crisis affordance (Q-12-007). A calm, always-available "Need help now?" control that opens
 * a panel of VERIFIED crisis resources (src/lib/safety/crisis-resources.ts). It can also be opened
 * automatically by the in-the-moment pre-check (passing a `category` to order the most relevant first).
 *
 * FAIL-SAFE: this only SHOWS the child resources — it notifies no one and reads no data, so it can never
 * mis-notify a feared caregiver. Only the verified resource set is shown; the bot itself never emits numbers.
 */
export function CrisisHelp({ open, onOpenChange, category }: CrisisHelpProps) {
    const resources = getCrisisResources(category);

    return (
        <>
            <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onOpenChange(true)}
                className="text-qc-primary hover:bg-qc-primary/10 gap-1.5"
                title="Get help now"
            >
                <Lifebuoy weight="duotone" className="w-4 h-4" />
                Need help now?
            </Button>

            {open && (
                <div
                    role="dialog"
                    aria-modal="true"
                    aria-label="Get help now"
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4"
                    onClick={() => onOpenChange(false)}
                >
                    <div
                        className="bg-white rounded-qc-lg shadow-qc-lg border border-qc-border-subtle max-w-md w-full max-h-[85vh] overflow-y-auto p-6"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-start justify-between gap-3 mb-3">
                            <h2 className="font-display text-xl font-bold text-qc-charcoal">You&apos;re not alone</h2>
                            <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)} title="Close">
                                <X />
                            </Button>
                        </div>
                        <p className="font-body text-sm text-qc-text-muted mb-4">
                            If you need help, here are people you can reach any time — free and private. If you or
                            someone else is in immediate danger, call your local emergency number.
                        </p>
                        <ul className="space-y-3">
                            {resources.map((r) => (
                                <li key={r.name} className="p-3 rounded-qc-md bg-qc-parchment">
                                    <p className="font-body font-semibold text-qc-text-primary">{r.name}</p>
                                    <p className="font-body text-qc-charcoal">{r.contact}</p>
                                    {r.note && <p className="font-body text-xs text-qc-text-muted mt-1">{r.note}</p>}
                                    {r.url && (
                                        <a
                                            href={r.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="font-body text-sm text-qc-primary hover:underline"
                                        >
                                            Open
                                        </a>
                                    )}
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            )}
        </>
    );
}

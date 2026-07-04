import type { ReactNode } from "react";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * Shared presentational primitives for the three "Inkling Profile" result cards
 * (Personality / Learning Style / Interests). Keeping the header, stat, chip, quote,
 * and empty-state markup in one place is what keeps the trio visually identical and
 * on-brand with the assessment wizard. Server-safe (no client hooks).
 */

/** Glass card with the signature gradient top-accent that ties back to the wizard. */
export function ProfileCard({
    children,
    className,
}: {
    children: ReactNode;
    className?: string;
}) {
    return (
        <Card
            className={cn(
                "relative overflow-hidden border-qc-border-subtle bg-white/80 shadow-qc-sm backdrop-blur-sm",
                className,
            )}
        >
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-qc-primary via-qc-secondary to-qc-primary opacity-70" />
            {children}
        </Card>
    );
}

/** Icon medallion + serif title + description. `icon` is an already-rendered element. */
export function ProfileHeader({
    icon,
    title,
    description,
}: {
    icon: ReactNode;
    title: string;
    description: string;
}) {
    return (
        <CardHeader>
            <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-qc-primary/10">
                    {icon}
                </span>
                <div>
                    <CardTitle className="font-display text-xl text-qc-primary">{title}</CardTitle>
                    <CardDescription>{description}</CardDescription>
                </div>
            </div>
        </CardHeader>
    );
}

/** A scannable micro-label + value tile. */
export function StatBlock({ label, value }: { label: string; value: string }) {
    return (
        <div className="rounded-qc-md border border-qc-border-subtle bg-white/60 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-qc-text-muted">
                {label}
            </p>
            <p className="mt-0.5 font-medium text-qc-charcoal">{value}</p>
        </div>
    );
}

/** A pill for tag-like values (hook worlds, expert topics). */
export function TraitChip({
    children,
    tone = "navy",
}: {
    children: ReactNode;
    tone?: "navy" | "gold";
}) {
    return (
        <span
            className={cn(
                "inline-flex items-center rounded-full px-3 py-1 text-sm font-medium",
                tone === "gold"
                    ? "border border-qc-secondary/30 bg-qc-secondary/10 text-qc-charcoal"
                    : "bg-qc-primary/10 text-qc-primary",
            )}
        >
            {children}
        </span>
    );
}

/** A generated-instruction block with a gold rule; `serif` renders it as an editorial quote. */
export function InstructionQuote({
    label,
    children,
    serif = false,
}: {
    label: string;
    children: ReactNode;
    serif?: boolean;
}) {
    return (
        <div>
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-qc-text-muted">
                {label}
            </p>
            <div className="rounded-qc-md border-l-2 border-qc-secondary bg-qc-parchment/70 p-3.5">
                <p
                    className={cn(
                        "leading-relaxed text-qc-charcoal",
                        serif ? "font-display text-[15px] italic" : "text-sm",
                    )}
                >
                    {children}
                </p>
            </div>
        </div>
    );
}

/** Centered empty state with a muted icon medallion + optional action. */
export function ProfileEmptyState({
    icon,
    message,
    action,
}: {
    icon: ReactNode;
    message: string;
    action?: ReactNode;
}) {
    return (
        <div className="flex flex-col items-center gap-3 py-8 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-qc-surface-muted">
                {icon}
            </span>
            <p className="max-w-xs text-sm text-qc-text-muted">{message}</p>
            {action}
        </div>
    );
}

export { CardContent };

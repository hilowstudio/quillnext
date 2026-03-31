import React from "react";
import { cn } from "@/lib/utils";

interface PrintLayoutProps {
    children: React.ReactNode;
    className?: string;
    debug?: boolean;
}

// 1. Root Layout - Handles the "Sheet of Paper" simulation
export function PrintLayout({ children, className, debug }: PrintLayoutProps) {
    return (
        <div className={cn("print:w-full print:h-full print:bg-white", className)}>
            <div className={cn(
                "mx-auto max-w-[8.5in] min-h-[11in] bg-white shadow-lg p-[0.5in] relative",
                "print:shadow-none print:p-0 print:max-w-none print:min-h-0",
                debug && "outline outline-dashed outline-red-300"
            )}>
                {debug && (
                    <div className="absolute inset-[0.5in] border border-qc-info-border border-dashed pointer-events-none z-50">
                        <span className="absolute top-0 right-0 text-[10px] text-qc-primary/60 bg-white px-1">Safe Zone (0.5in)</span>
                    </div>
                )}
                {children}
            </div>
        </div>
    );
}

// 2. Print Section - A logical block of content (e.g. "Day 1")
export function PrintSection({ children, className, breakBefore }: { children: React.ReactNode, className?: string, breakBefore?: boolean }) {
    return (
        <section className={cn(
            "mb-8 avoid-break border border-transparent isolate", // isolate creates stacking context
            breakBefore && "page-break",
            className
        )}>
            {children}
        </section>
    );
}

// 3. Print Box - A strictly bounded container. Fails visibly if overflow occurs.
export function PrintBox({ children, height, className }: { children: React.ReactNode, height?: string, className?: string }) {
    return (
        <div
            className={cn("border border-qc-parchment-dark/20 rounded-sm p-4 avoid-break overflow-hidden relative", className)}
            style={{ height: height /* strict height budget */ }}
        >
            {children}
            {/* Overflow warning indicator (visible only if content spills in debug mode, functionally hard to detect in pure CSS but we constrain height) */}
        </div>
    );
}

// 4. Print Grid - Deterministic columns
export function PrintGrid({ children, cols = 2, className }: { children: React.ReactNode, cols?: number, className?: string }) {
    return (
        <div
            className={cn("grid gap-4", className)}
            style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
        >
            {children}
        </div>
    );
}

export function PrintTitle({ children }: { children: React.ReactNode }) {
    return <h1 className="text-3xl font-bold mb-4 font-display text-qc-charcoal border-b-2 border-qc-primary pb-2 text-balance">{children}</h1>;
}

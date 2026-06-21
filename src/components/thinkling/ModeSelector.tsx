"use client";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { GraduationCap, MagnifyingGlass, Compass, type Icon } from "@phosphor-icons/react";
import { ThinklingMode } from "@/lib/thinkling";

interface ModeSelectorProps {
    selectedMode: string;
    onSelectMode: (mode: ThinklingMode) => void;
}

const MODES = [
    {
        id: "TUTOR",
        label: "Subject Tutor",
        description: "Help with specific subjects and concepts.",
        icon: GraduationCap,
        color: "text-blue-500",
        bg: "bg-blue-50"
    },
    {
        id: "RESEARCH",
        label: "Research Assistant",
        description: "Find resources and form hypotheses.",
        icon: MagnifyingGlass,
        color: "text-purple-500",
        bg: "bg-purple-50"
    },
    {
        id: "CAREER",
        label: "College & Career",
        description: "Explore future paths and requirements.",
        icon: Compass,
        color: "text-green-500",
        bg: "bg-green-50"
    }
] as const satisfies readonly { id: ThinklingMode; label: string; description: string; icon: Icon; color: string; bg: string }[];

export function ModeSelector({ selectedMode, onSelectMode }: ModeSelectorProps) {
    return (
        <div className="flex flex-wrap gap-2 p-1 bg-qc-parchment/50 rounded-lg">
            {MODES.map((mode) => (
                <button
                    key={mode.id}
                    onClick={() => onSelectMode(mode.id as ThinklingMode)}
                    className={cn(
                        "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all",
                        selectedMode === mode.id
                            ? "bg-white text-qc-primary shadow-sm ring-1 ring-qc-border-subtle"
                            : "text-qc-text-muted hover:bg-white/50 hover:text-qc-charcoal"
                    )}
                >
                    <mode.icon size={16} weight={selectedMode === mode.id ? "fill" : "regular"} className={selectedMode === mode.id ? mode.color : ""} />
                    <span>{mode.label}</span>
                </button>
            ))}
        </div>
    );
}

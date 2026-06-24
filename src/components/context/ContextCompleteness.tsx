"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  CheckCircle,
  XCircle,
  Warning,
  Info,
  CaretRight,
  HouseLine,
  Student,
  GraduationCap,
  Books,
  CalendarCheck
} from "@phosphor-icons/react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { Icon } from "@phosphor-icons/react";
import type { ContextSuggestion } from "@/lib/context/context-types";
import { getContextImpactDescription } from "@/lib/context/context-types";

interface ContextCompletenessProps {
  completeness: number;
  suggestions: ContextSuggestion[];
}

type PillarStatus = "complete" | "partial" | "missing";

interface Pillar {
  id: "family" | "student" | "academic" | "library" | "schedule";
  label: string;
  icon: Icon;
  status: PillarStatus;
  suggestion?: ContextSuggestion;
}

export function ContextCompleteness({
  completeness,
  suggestions,
}: ContextCompletenessProps) {

  // Helper to determine status based on suggestions
  const getPillarStatus = (category: Pillar["id"]): { status: PillarStatus; suggestion?: ContextSuggestion } => {
    // Find highest priority suggestion for this category
    const relevantSuggestions = suggestions.filter(s => s.category === category);
    const missing = relevantSuggestions.find(s => s.type === "missing");
    const enhancement = relevantSuggestions.find(s => s.type === "enhancement");
    const opportunity = relevantSuggestions.find(s => s.type === "opportunity");

    if (missing) return { status: "missing", suggestion: missing };
    if (enhancement) return { status: "partial", suggestion: enhancement };
    // Opportunity doesn't necessarily mean incomplete, but we can show it as partial if we want strictness.
    // For now, let's treat "opportunity" as complete but with a tip, OR partial. 
    // Let's go with "complete" visually but maybe a subtle indicator? 
    // Actually, distinct logic: Missing = Red X, Enhancement/Opp = Yellow Warning, None = Green Check
    if (opportunity) return { status: "partial", suggestion: opportunity };

    return { status: "complete" };
  };

  const pillars: Pillar[] = [
    { id: "family", label: "School Context", icon: HouseLine, ...getPillarStatus("family") },
    { id: "student", label: "Student Profile(s)", icon: Student, ...getPillarStatus("student") },
    { id: "academic", label: "Set Courses", icon: GraduationCap, ...getPillarStatus("academic") },
    { id: "library", label: "Living Library", icon: Books, ...getPillarStatus("library") },
    { id: "schedule", label: "Schedule", icon: CalendarCheck, ...getPillarStatus("schedule") },
  ];

  // Gauge configurations
  const radius = 50;
  const stroke = 8;
  const normalizedRadius = radius - stroke * 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  const strokeDashoffset = circumference - (completeness / 100) * circumference;

  const getColor = (score: number) => {
    if (score >= 80) return "text-qc-primary";
    if (score >= 50) return "text-qc-warning";
    return "text-qc-error";
  };

  return (
    <Card className="overflow-hidden border-qc-border-subtle shadow-sm hover:shadow-md transition-shadow duration-300">
      <div className="grid grid-cols-1 md:grid-cols-3">
        {/* Left: Gauge & Score */}
        <div className="p-6 bg-qc-parchment/30 flex flex-col items-center justify-center border-b md:border-b-0 md:border-r border-qc-border-subtle relative">
          <div className="relative w-40 h-40 flex items-center justify-center">
            {/* Background Circle */}
            <svg
              height={radius * 2}
              width={radius * 2}
              className="transform -rotate-90"
            >
              <circle
                stroke="currentColor"
                strokeWidth={stroke}
                fill="transparent"
                r={normalizedRadius}
                cx={radius}
                cy={radius}
                className="text-qc-border-subtle"
              />
              {/* Progress Circle */}
              <motion.circle
                initial={{ strokeDashoffset: circumference }}
                animate={{ strokeDashoffset }}
                transition={{ duration: 1, ease: "easeOut" }}
                stroke="currentColor"
                strokeWidth={stroke}
                strokeLinecap="round"
                fill="transparent"
                r={normalizedRadius}
                cx={radius}
                cy={radius}
                style={{ strokeDasharray: circumference + " " + circumference }}
                className={getColor(completeness)}
              />
            </svg>

            {/* Center Text */}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className={`text-2xl font-display font-bold ${getColor(completeness)}`}>
                {completeness}%
              </span>
              <span className="text-[10px] font-medium text-qc-text-muted uppercase tracking-wider mt-0.5">
                Health
              </span>
            </div>
          </div>

          <div className="mt-4 text-center">
            <h3 className="font-display text-lg font-bold text-qc-charcoal text-balance">Context Health</h3>
            <p className="text-sm text-qc-text-muted px-4 qc-prose">
              {completeness >= 80
                ? "Excellent! Your Inkling context is rich and personalized."
                : "Complete your profile to receive the full benefits of the Inkling personalization engine."}
            </p>
          </div>
        </div>

        {/* Right: Pillars Checklist */}
        <div className="col-span-2 p-6 bg-qc-surface">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-display text-base font-semibold text-qc-charcoal text-balance">Context Pillars</h4>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Info size={18} className="text-qc-text-muted hover:text-qc-primary transition-colors" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs p-4">
                  <p className="text-sm">These 5 pillars inform every lesson plan, ensuring it fits your family&apos;s unique style.</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          <div className="space-y-3">
            {pillars.map((pillar) => (
              <div
                key={pillar.id}
                className={`flex items-start justify-between p-3 rounded-lg border transition-all ${pillar.status === 'missing' ? 'bg-qc-error-bg border-qc-error-border' :
                  pillar.status === 'partial' ? 'bg-qc-warning-bg border-qc-warning-border' :
                    'bg-qc-surface border-qc-border-subtle hover:border-qc-primary/30'
                  }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`mt-0.5 p-1.5 rounded-full ${pillar.status === 'complete' ? 'bg-qc-success-bg text-qc-success' :
                    pillar.status === 'partial' ? 'bg-qc-warning-bg text-qc-warning' :
                      'bg-qc-error-bg text-qc-error'
                    }`}>
                    <pillar.icon size={16} weight="fill" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm text-qc-charcoal">{pillar.label}</span>
                      {pillar.status === 'complete' && <CheckCircle size={16} weight="fill" className="text-qc-success" />}
                    </div>

                    {pillar.status !== 'complete' && pillar.suggestion && (
                      <p className="text-xs text-qc-text-muted mt-1 max-w-[280px]">
                        {pillar.suggestion.title}
                      </p>
                    )}

                    {/* Hover impact description could go here, or simple text */}
                    {pillar.status === 'complete' && (
                      <p className="text-xs text-qc-text-muted mt-1 opacity-70">
                        {getContextImpactDescription(pillar.id).slice(0, 60)}...
                      </p>
                    )}
                  </div>
                </div>

                {pillar.suggestion ? (
                  <Button size="sm" variant="outline" className="h-8 text-xs ml-2 shrink-0 bg-white" asChild>
                    <Link href={pillar.suggestion.actionUrl}>
                      Fix <CaretRight size={12} className="ml-1" />
                    </Link>
                  </Button>
                ) : (
                  <div className="h-8 flex items-center px-3">
                    <span className="text-xs font-medium text-qc-success-text bg-qc-success-bg px-2 py-0.5 rounded-full border border-qc-success-border">
                      Active
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
}

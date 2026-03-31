"use client";

import { useState, useEffect } from "react";
import { UseFormRegister, UseFormSetValue, UseFormWatch } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Check, CaretRight, CaretDown, Info } from "@phosphor-icons/react";
import { StudentFormData } from "@/lib/schemas/students";

// -----------------------------------------------------------------------
// Constants & Options
// -----------------------------------------------------------------------

const OPTIONAL_LABELS = [
    "ADHD",
    "Autism Spectrum (ASD)",
    "Sensory Processing Differences",
    "Dyslexia",
    "Dyscalculia",
    "Dysgraphia",
    "Speech or language differences",
    "Other / Not listed",
    "Prefer not to say",
];

const CORE_SUPPORTS = {
    focus: {
        title: "A. Focus & Attention",
        options: [
            "Shorter lessons or tasks",
            "One step at a time",
            "Fewer distractions on the page",
            "Gentle reminders to stay on task",
        ],
    },
    instructions: {
        title: "B. Instructions & Language",
        options: [
            "Clear, step-by-step instructions",
            "Simple, direct wording",
            "Visual examples or diagrams",
            "Extra time to process information",
        ],
    },
    organization: {
        title: "C. Organization & Planning",
        options: [
            "Checklists for tasks",
            "Clear goals and expectations",
            "Predictable lesson structure",
            "Help breaking big tasks into parts",
        ],
    },
    reading: {
        title: "D. Reading Support",
        options: [
            "Shorter reading passages",
            "Key ideas highlighted",
            "Larger or easier-to-read text",
            "Option to hear text read aloud",
        ],
    },
    writing: {
        title: "E. Writing & Responses",
        options: [
            "Sentence starters or templates",
            "Fewer written responses",
            "Option to answer in different ways",
            "Help organizing ideas before writing",
        ],
    },
    math: {
        title: "F. Math Support",
        options: [
            "Step-by-step problem solving",
            "Visual models or examples",
            "Fewer practice problems",
            "Formula or reference sheets",
        ],
    },
    sensory: {
        title: "G. Sensory & Comfort",
        options: [
            "Simple, uncluttered pages",
            "Calm colors and layout",
            "No time pressure",
            "Limited animations or sound",
        ],
    },
    emotional: {
        title: "H. Confidence & Emotional Support",
        options: [
            "Clear expectations before starting",
            "Low-pressure practice",
            "Encouraging, reassuring tone",
            "Extra practice before assessments",
        ],
    },
};

interface WizardProps {
    register: UseFormRegister<StudentFormData>;
    setValue: UseFormSetValue<StudentFormData>;
    watch: UseFormWatch<StudentFormData>;
}

export function SupportProfileWizard({ register, setValue, watch }: WizardProps) {
    // Local State for Progressive Disclosure
    const [gatewayAnswer, setGatewayAnswer] = useState<"YES" | "NO" | "NOT_SURE" | null>(null);
    const [showOptionalLabels, setShowOptionalLabels] = useState(false);
    const [showCoreSupports, setShowCoreSupports] = useState(false);
    const [showIntensity, setShowIntensity] = useState(false);

    // Form State Watchers
    const selectedLabels = watch("supportLabels") || [];
    const supportProfile = (watch("supportProfile") as Record<string, string[]>) || {};
    const supportIntensity = watch("supportIntensity");

    // Handlers
    const handleGatewaySelect = (answer: "YES" | "NO" | "NOT_SURE") => {
        setGatewayAnswer(answer);
        if (answer === "YES" || answer === "NOT_SURE") {
            setShowOptionalLabels(true);
            setShowCoreSupports(false); // Reset subsequent steps if backtracking
        } else {
            setShowOptionalLabels(false);
            setShowCoreSupports(true); // Skip to core supports
            setValue("supportLabels", []); // Clear labels if No
        }
    };

    const toggleLabel = (label: string) => {
        const current = [...selectedLabels];
        if (current.includes(label)) {
            setValue("supportLabels", current.filter((l) => l !== label));
        } else {
            setValue("supportLabels", [...current, label]);
        }
        // Auto-advance logic could go here, but user might want to select multiple
        if (!showCoreSupports) setShowCoreSupports(true);
    };

    const toggleSupport = (category: string, option: string) => {
        const currentProfile = { ...supportProfile };
        const categoryOptions = currentProfile[category] || [];

        if (categoryOptions.includes(option)) {
            currentProfile[category] = categoryOptions.filter((o) => o !== option);
        } else {
            currentProfile[category] = [...categoryOptions, option];
        }

        if (currentProfile[category].length === 0) {
            delete currentProfile[category];
        }

        setValue("supportProfile", currentProfile);
        if (!showIntensity) setShowIntensity(true);
    };

    return (
        <div className="space-y-8 border-t border-qc-border-subtle pt-6">
            {/* SECTION 1: FRAMING */}
            <div className="space-y-2">
                <h3 className="font-display text-lg font-bold text-qc-charcoal text-balance">
                    Learning Support Preferences
                </h3>
                <div className="bg-qc-primary/5 p-4 rounded-qc-md border border-qc-primary/10">
                    <p className="text-sm font-body text-qc-charcoal mb-2">
                        Every child learns differently. The information below helps us adjust explanations,
                        activities, and practice to better support your child.
                    </p>
                    <p className="text-sm font-body text-qc-text-muted">
                        You can update this anytime, and you don’t need a formal diagnosis to make selections.
                    </p>
                </div>
            </div>

            {/* SECTION 2: GATEWAY QUESTION */}
            <div className="space-y-4">
                <Label className="text-base font-semibold">
                    Does your child have any learning differences or support needs we should consider?
                </Label>
                <div className="flex flex-col gap-3 sm:flex-row">
                    {(["YES", "NOT_SURE", "NO"] as const).map((option) => (
                        <div
                            key={option}
                            className={`
                flex items-center gap-2 p-3 rounded-qc-md border cursor-pointer transition-all
                ${gatewayAnswer === option
                                    ? "border-qc-primary bg-qc-primary/5 ring-1 ring-qc-primary"
                                    : "border-qc-border-subtle hover:border-qc-primary/30 bg-white"}
              `}
                            onClick={() => handleGatewaySelect(option)}
                        >
                            <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${gatewayAnswer === option ? "border-qc-primary" : "border-qc-text-muted"}`}>
                                {gatewayAnswer === option && <div className="w-2 h-2 rounded-full bg-qc-primary" />}
                            </div>
                            <span className="text-sm font-medium">
                                {option === "YES" ? "Yes" : option === "NOT_SURE" ? "Not sure" : "No"}
                            </span>
                        </div>
                    ))}
                </div>
                <p className="text-xs text-qc-text-muted italic">
                    Many families select “Yes” or “Not sure.” Either choice will let you choose learning supports next.
                </p>
            </div>

            {/* SECTION 3: OPTIONAL LABELS (Result of Yes/Not Sure) */}
            {showOptionalLabels && (
                <div className="space-y-4 animate-in fade-in slide-in-from-top-4 duration-500">
                    <div className="space-y-1">
                        <Label className="text-base font-semibold">
                            Optional: Common Learning Differences
                        </Label>
                        <p className="text-sm text-qc-text-muted">
                            Some families find it helpful to select from the list below. This is optional.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {OPTIONAL_LABELS.map((label) => {
                            const isSelected = selectedLabels.includes(label);
                            return (
                                <div
                                    key={label}
                                    onClick={() => toggleLabel(label)}
                                    className={`
                    flex items-center gap-3 p-3 rounded-qc-md border cursor-pointer transition-all
                    ${isSelected
                                            ? "border-qc-primary bg-qc-primary/5 text-qc-primary-dark font-medium"
                                            : "border-qc-border-subtle hover:bg-qc-surface-hover text-qc-charcoal"}
                  `}
                                >
                                    <div className={`
                    w-4 h-4 rounded border flex items-center justify-center
                    ${isSelected ? "bg-qc-primary border-qc-primary text-white" : "border-qc-border-subtle bg-white"}
                  `}>
                                        {isSelected && <Check size={12} strokeWidth={3} />}
                                    </div>
                                    <span className="text-sm">{label}</span>
                                </div>
                            );
                        })}
                    </div>
                    <div className="flex items-start gap-2 text-xs text-qc-text-muted bg-qc-surface-raised p-3 rounded-md">
                        <Info size={14} className="mt-0.5 flex-shrink-0" />
                        <p>You don’t need a formal diagnosis to select any option. This information is used only to help suggest customized learning supports.</p>
                    </div>
                </div>
            )}

            {/* SECTION 4: CORE SUPPORTS */}
            {(showCoreSupports || showOptionalLabels) && (
                <div className="space-y-6 animate-in fade-in slide-in-from-top-8 duration-700">
                    <div className="space-y-1 pt-4 border-t border-qc-border-subtle">
                        <h3 className="text-xl font-display font-bold text-qc-charcoal text-balance">
                            What supports help your child learn best?
                        </h3>
                        <p className="text-sm text-qc-text-muted">
                            Select all that apply. These choices help us personalize lessons and practice.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {Object.entries(CORE_SUPPORTS).map(([key, section]) => (
                            <Card key={key} className="border-qc-border-subtle shadow-sm">
                                <CardContent className="p-4 space-y-3">
                                    <h4 className="font-bold text-sm text-qc-charcoal border-b border-qc-border-subtle/50 pb-2 mb-2">
                                        {section.title}
                                    </h4>
                                    <div className="space-y-2">
                                        {section.options.map((option) => {
                                            const isChecked = (supportProfile[key] || []).includes(option);
                                            return (
                                                <div
                                                    key={option}
                                                    onClick={() => toggleSupport(key, option)}
                                                    className="flex items-start gap-2 cursor-pointer group"
                                                >
                                                    <div className={`
                            mt-0.5 w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center transition-colors
                            ${isChecked
                                                            ? "bg-qc-primary border-qc-primary text-white"
                                                            : "border-qc-border-subtle bg-white group-hover:border-qc-primary/50"}
                          `}>
                                                        {isChecked && <Check size={12} strokeWidth={3} />}
                                                    </div>
                                                    <span className={`text-sm leading-tight transition-colors ${isChecked ? "text-qc-charcoal font-medium" : "text-qc-text-muted group-hover:text-qc-charcoal"}`}>
                                                        {option}
                                                    </span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </div>
            )}

            {/* SECTION 5: INTENSITY */}
            {(showCoreSupports || showIntensity) && (
                <div className="space-y-4 pt-4 border-t border-qc-border-subtle animate-in fade-in slide-in-from-top-8 duration-700">
                    <Label className="text-base font-semibold">
                        How much built-in support would you like?
                    </Label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {[
                            { value: "LOW", label: "A little support" },
                            { value: "MODERATE", label: "A moderate amount" },
                            { value: "HIGH", label: "A lot of support" }
                        ].map((level) => (
                            <div
                                key={level.value}
                                onClick={() => setValue("supportIntensity", level.value)}
                                className={`
                  flex items-center justify-center p-4 rounded-qc-md border cursor-pointer transition-all text-center
                  ${supportIntensity === level.value
                                        ? "border-qc-primary bg-qc-primary/5 ring-1 ring-qc-primary font-bold text-qc-primary-dark"
                                        : "border-qc-border-subtle hover:border-qc-primary/30 bg-white"}
                `}
                            >
                                <span className="text-sm">{level.label}</span>
                            </div>
                        ))}
                    </div>
                    <p className="text-xs text-qc-text-muted">
                        This control adjusts how much guidance, repetition, and structure is included in Inkling-generated content. You can change this anytime.
                    </p>
                </div>
            )}
        </div>
    );
}

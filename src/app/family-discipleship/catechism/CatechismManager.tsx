"use client";

import React, { useState } from 'react';
import { GraduationCap } from '@phosphor-icons/react/dist/ssr';
import { cn } from "@/lib/utils";
import InteractiveCatechism from './InteractiveCatechism';
import { getCatechismQuestions } from './actions';
import type { CatechismSummary } from './types';

interface CatechismManagerProps {
    studentId?: string;
    catechisms: CatechismSummary[];
}

export function CatechismManager({ studentId, catechisms }: CatechismManagerProps) {
    const [selected, setSelected] = useState<CatechismSummary | null>(null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [questions, setQuestions] = useState<any[] | null>(null);
    const [loading, setLoading] = useState(false);

    // Color pattern using Tailwind classes/custom tokens
    const colorPattern = [
        'bg-qc-secondary', // Gold
        'bg-qc-primary',   // Blue/Primary
        'bg-qc-charcoal',  // Dark
        'bg-qc-primary/80' // Using opacity for variety or another token
    ];

    const getCardColor = (index: number) => {
        return colorPattern[index % colorPattern.length];
    };

    const handleCatechismAssignment = async (catechism: CatechismSummary) => {
        setSelected(catechism);
        setQuestions(null);
        setLoading(true);
        try {
            const qs = await getCatechismQuestions(catechism.id);
            setQuestions(qs);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-8">

            {/* Catechism Selection - Carousel */}
            <div className="relative">
                <div className="overflow-x-auto scrollbar-hide py-4 scroll-smooth">
                    <div className="flex gap-6 px-1">
                        {catechisms.map((config, index) => (
                            <div
                                key={config.id}
                                className={cn(
                                    "rounded-xl p-6 text-white shadow-lg cursor-pointer hover:shadow-xl transition-all duration-200 transform hover:scale-[1.02] min-w-[280px] md:min-w-[320px] flex-shrink-0 touch-manipulation min-h-[44px]",
                                    getCardColor(index),
                                    selected?.id === config.id ? 'ring-4 ring-offset-2 ring-qc-primary' : ''
                                )}
                                onClick={() => handleCatechismAssignment(config)}
                            >
                                <div className="flex items-center mb-4">
                                    <GraduationCap className="text-3xl" />
                                </div>
                                <h3 className="text-xl font-bold mb-2">{config.title}</h3>
                                <p className="text-sm opacity-90 mb-3">{config.description}</p>
                                <div className="flex items-center justify-between text-sm opacity-75">
                                    <span>{config.questionCount} questions</span>
                                    <span className="bg-white/20 px-2 py-0.5 rounded text-xs uppercase tracking-wide">{config.difficulty}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Interactive Catechism */}
            {selected ? (
                <div className="mt-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="p-6 bg-white/50 border border-qc-border-subtle rounded-xl mb-6 backdrop-blur-sm">
                        <h3 className="text-2xl font-bold text-qc-primary">
                            {selected.title}
                        </h3>
                        <p className="text-qc-text-muted mt-2">
                            Select a mode below to start practicing.
                        </p>
                    </div>
                    {loading || !questions ? (
                        <div className="mt-8 p-12 text-center bg-white/50 border border-qc-border-subtle rounded-xl text-qc-text-muted">
                            <p className="text-lg font-medium">Loading questions…</p>
                        </div>
                    ) : (
                        <InteractiveCatechism
                            catechismData={questions}
                            title={selected.title}
                            studentId={studentId}
                            catechismId={selected.id}
                        />
                    )}
                </div>
            ) : (
                <div className="mt-8 p-12 text-center bg-white/50 border border-dashed border-qc-border-subtle rounded-xl text-qc-text-muted">
                    <GraduationCap className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p className="text-lg font-medium">Select a catechism above to begin studying</p>
                </div>
            )}
        </div>
    );
}

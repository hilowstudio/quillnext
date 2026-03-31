"use client";

import React from "react";
import { Plus, Trash, Trophy } from "@phosphor-icons/react";
import type { Activity, ActivityCategory } from "./types";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

interface ActivitiesSectionProps {
    activities: Activity[];
    onChange: (activities: Activity[]) => void;
}

const CATEGORIES: { value: ActivityCategory; label: string }[] = [
    { value: 'academic-honors', label: 'Academic Honors' },
    { value: 'extracurricular-clubs', label: 'Clubs & Organizations' },
    { value: 'arts-creative', label: 'Arts & Creative' },
    { value: 'athletics', label: 'Athletics' },
    { value: 'community-service', label: 'Community Service' },
    { value: 'work-experience', label: 'Work Experience' },
    { value: 'leadership', label: 'Leadership' },
    { value: 'special-programs', label: 'Special Programs' },
    { value: 'certifications', label: 'Certifications' },
    { value: 'independent-study', label: 'Independent Study' },
    { value: 'other', label: 'Other' },
];

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function ActivitiesSection({ activities, onChange }: ActivitiesSectionProps) {
    const handleAdd = () => {
        const newActivity: Activity = {
            id: `act-${Date.now()}`,
            title: "",
            category: "extracurricular-clubs",
            years: "9-12"
        };
        onChange([...activities, newActivity]);
    };

    const handleUpdate = (id: string, updates: Partial<Activity>) => {
        const updated = activities.map(a => a.id === id ? { ...a, ...updates } : a);
        onChange(updated);
    };

    const handleDelete = (id: string) => {
        onChange(activities.filter(a => a.id !== id));
    };

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
            <div className="flex items-center justify-between border-b pb-4">
                <div>
                    <h3 className="text-xl font-semibold text-[#563963]">Activities & Awards</h3>
                    <p className="text-sm text-qc-text-muted">Extracurriculars, volunteer work, and honors.</p>
                </div>
                <Button
                    onClick={handleAdd}
                    size="sm"
                    className="bg-[#563963] text-white hover:bg-[#563963]/90 shadow-sm transition-all hover:translate-y-[-1px]"
                >
                    <Plus size={16} className="mr-2" /> Add Activity
                </Button>
            </div>

            <div className="space-y-4">
                {activities.length === 0 ? (
                    <Card className="border-dashed border-2 shadow-none bg-qc-surface-raised/50">
                        <div className="flex flex-col items-center justify-center py-16 text-center space-y-4">
                            <div className="h-12 w-12 rounded-full bg-[#563963]/10 flex items-center justify-center text-[#563963]">
                                <Trophy size={24} />
                            </div>
                            <div className="space-y-1">
                                <p className="text-base font-semibold text-qc-charcoal">No activities recorded</p>
                                <p className="text-sm text-qc-text-muted max-w-sm mx-auto">Colleges look for well-rounded students. Add clubs, sports, or volunteer work.</p>
                            </div>
                            <Button onClick={handleAdd} variant="outline" className="mt-2">
                                Add First Activity
                            </Button>
                        </div>
                    </Card>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-1 gap-4">
                        {activities.map((activity) => (
                            <Card key={activity.id} className="group relative border shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden">
                                <div className="absolute top-0 left-0 w-1 h-full bg-[#563963]/20 group-hover:bg-[#563963] transition-colors" />

                                <div className="p-5 pl-7">
                                    <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-red-300 hover:text-red-500 hover:bg-red-50"
                                            onClick={() => handleDelete(activity.id)}
                                        >
                                            <Trash size={16} />
                                        </Button>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                                        {/* Main Info */}
                                        <div className="md:col-span-7 space-y-4">
                                            <div className="space-y-1">
                                                <Label className="text-xs font-semibold text-qc-text-muted uppercase tracking-wider">Activity Title</Label>
                                                <Input
                                                    value={activity.title}
                                                    onChange={(e) => handleUpdate(activity.id, { title: e.target.value })}
                                                    placeholder="e.g. Varsity Soccer, Debate Club"
                                                    className="font-semibold text-lg h-9 border-transparent -ml-2 px-2 hover:bg-qc-surface-hover focus:bg-white focus:border-[#563963] focus:ring-[#563963]/10 transition-all placeholder:text-qc-border-subtle"
                                                />
                                            </div>

                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="space-y-1">
                                                    <Label className="text-xs text-qc-text-muted">Position / Role</Label>
                                                    <Input
                                                        value={activity.position || ""}
                                                        onChange={(e) => handleUpdate(activity.id, { position: e.target.value })}
                                                        placeholder="e.g. Captain"
                                                        className="h-8 text-sm border-transparent -ml-2 px-2 bg-transparent hover:bg-qc-surface-hover focus:bg-white focus:border-[#563963] focus:ring-[#563963]/10 transition-all"
                                                    />
                                                </div>
                                                <div className="space-y-1">
                                                    <Label className="text-xs text-qc-text-muted">Category</Label>
                                                    <Select
                                                        value={activity.category}
                                                        onValueChange={(val) => handleUpdate(activity.id, { category: val as ActivityCategory })}
                                                    >
                                                        <SelectTrigger className="h-8 border-transparent bg-qc-surface-raised/50 hover:bg-qc-surface-hover focus:ring-[#563963]/10 text-xs">
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Details */}
                                        <div className="md:col-span-5 space-y-4 bg-qc-surface-raised/30 rounded-lg p-4 -my-2">
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="space-y-1">
                                                    <Label className="text-xs text-qc-text-muted">Grade Levels</Label>
                                                    <Input
                                                        value={activity.years || ""}
                                                        onChange={(e) => handleUpdate(activity.id, { years: e.target.value })}
                                                        placeholder="9, 10, 11, 12"
                                                        className="h-8 text-sm bg-white border-qc-border-subtle focus:border-[#563963] focus:ring-[#563963]/10"
                                                    />
                                                </div>
                                                <div className="space-y-1">
                                                    <Label className="text-xs text-qc-text-muted">Time / Hours</Label>
                                                    <Input
                                                        value={activity.hours || ""}
                                                        onChange={(e) => handleUpdate(activity.id, { hours: e.target.value })}
                                                        placeholder="5 hrs/wk"
                                                        className="h-8 text-sm bg-white border-qc-border-subtle focus:border-[#563963] focus:ring-[#563963]/10"
                                                    />
                                                </div>
                                            </div>
                                            <div className="space-y-1">
                                                <Label className="text-xs text-qc-text-muted">Description</Label>
                                                <Textarea
                                                    value={activity.description || ""}
                                                    onChange={(e) => handleUpdate(activity.id, { description: e.target.value })}
                                                    placeholder="Achievements, responsibilities, or details..."
                                                    className="h-20 text-xs resize-none bg-white border-qc-border-subtle focus:border-[#563963] focus:ring-[#563963]/10"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </Card>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

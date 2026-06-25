"use client";

import React from "react";
import { Plus, Trash, BookOpen, FileText } from "@phosphor-icons/react";
import type { TranscriptCourse, CourseType, GPASettings } from "./types";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";

interface CourseEntrySectionProps {
    gradeLevel: number;
    courses: TranscriptCourse[];
    onChange: (courses: TranscriptCourse[]) => void;
    yearRange: { start: number; end: number };
    settings?: GPASettings;
}

export function CourseEntrySection({ gradeLevel, courses, onChange, yearRange, settings }: CourseEntrySectionProps) {
    const currentCourses = courses.filter(c => c.gradeLevel === gradeLevel);

    const handleAddCourse = () => {
        const newCourse: TranscriptCourse = {
            id: `new-${Date.now()}`,
            courseName: "",
            subject: "General",
            grade: "",
            credits: 1,
            courseType: "Regular",
            gradeLevel,
            included: true,
            yearRange
        };
        onChange([...courses, newCourse]);
    };

    const handleUpdateCourse = (id: string, updates: Partial<TranscriptCourse>) => {
        const updated = courses.map(c => c.id === id ? { ...c, ...updates } : c);
        onChange(updated);
    };

    const handleDeleteCourse = (id: string) => {
        const updated = courses.filter(c => c.id !== id);
        onChange(updated);
    };

    return (
        <Card className="border shadow-sm overflow-hidden mb-6">
            <div className="flex items-center justify-between px-6 py-4 bg-qc-surface-raised/50 border-b">
                <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-[#563963] flex items-center justify-center text-white font-bold text-sm shadow-sm">
                        {gradeLevel}
                    </div>
                    <div>
                        <h3 className="font-semibold text-qc-charcoal leading-none">
                            {gradeLevel === 0 ? "Pre-High School" : `${gradeLevel}th Grade`}
                        </h3>
                        <p className="text-xs text-qc-text-muted mt-1 font-medium">{yearRange.start} - {yearRange.end}</p>
                    </div>
                </div>
                <Button
                    onClick={handleAddCourse}
                    size="sm"
                    variant="ghost"
                    className="text-[#563963] hover:text-[#563963] hover:bg-[#563963]/10 h-8 text-xs font-medium"
                >
                    <Plus size={12} className="mr-1.5" /> ADD COURSE
                </Button>
            </div>

            <div className="bg-white min-h-[100px]">
                {currentCourses.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center space-y-3">
                        <div className="h-10 w-10 rounded-full bg-qc-surface-raised flex items-center justify-center text-qc-text-muted">
                            <BookOpen size={20} className="opacity-50" />
                        </div>
                        <div className="space-y-1">
                            <p className="text-sm font-medium text-qc-charcoal">No courses yet</p>
                            <p className="text-xs text-qc-text-muted max-w-[200px] mx-auto">Add regular, honors, or AP courses taken during this academic year.</p>
                        </div>
                        <Button onClick={handleAddCourse} variant="outline" size="sm" className="mt-2 text-xs">
                            Add First Course
                        </Button>
                    </div>
                ) : (
                    <div>
                        {/* Header Row */}
                        <div className="grid grid-cols-12 gap-3 px-4 py-2 bg-qc-surface-raised/30 border-b text-[10px] font-bold text-qc-text-muted uppercase tracking-wider">
                            <div className="col-span-5 md:col-span-4 pl-2">Course Title</div>
                            <div className="col-span-2 md:col-span-2">Subject</div>
                            <div className="col-span-2 md:col-span-2 text-center">Level</div>
                            <div className="col-span-1 md:col-span-1 text-center">Grade</div>
                            <div className="col-span-1 md:col-span-1 text-center">Cr</div>
                            <div className="col-span-1 md:col-span-2"></div>
                        </div>

                        <div className="divide-y divide-qc-border-subtle">
                            {currentCourses.map((course) => (
                                <div key={course.id} className="group hover:bg-qc-surface-hover/40 transition-colors p-2">
                                    <div className="grid grid-cols-12 gap-3 items-center">
                                        {/* Name */}
                                        <div className="col-span-5 md:col-span-4">
                                            <Input
                                                value={course.courseName}
                                                onChange={(e) => handleUpdateCourse(course.id, { courseName: e.target.value })}
                                                placeholder="e.g. Algebra I"
                                                className="h-9 border-transparent bg-transparent hover:bg-white hover:border-qc-border-subtle focus:bg-white focus:border-[#563963] focus:ring-2 focus:ring-[#563963]/10 font-medium text-qc-charcoal transition-all placeholder:text-qc-border-subtle"
                                            />
                                        </div>

                                        {/* Subject */}
                                        <div className="col-span-2 md:col-span-2">
                                            <Select value={course.subject} onValueChange={(val) => handleUpdateCourse(course.id, { subject: val })}>
                                                <SelectTrigger className="h-9 border-transparent bg-transparent hover:bg-white hover:border-qc-border-subtle focus:bg-white focus:border-[#563963] focus:ring-2 focus:ring-[#563963]/10 text-xs transition-all text-qc-text-muted">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="English">English</SelectItem>
                                                    <SelectItem value="Mathematics">Math</SelectItem>
                                                    <SelectItem value="Science">Science</SelectItem>
                                                    <SelectItem value="Social Studies">Social Studies</SelectItem>
                                                    <SelectItem value="Foreign Language">Foreign Lang</SelectItem>
                                                    <SelectItem value="Fine Arts">Fine Arts</SelectItem>
                                                    <SelectItem value="Physical Education">PE</SelectItem>
                                                    <SelectItem value="Elective">Elective</SelectItem>
                                                    <SelectItem value="General">General</SelectItem>
                                                    <SelectItem value="Other">Other</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        {/* Type */}
                                        <div className="col-span-2 md:col-span-2">
                                            <Select
                                                value={course.courseType}
                                                onValueChange={(val) => handleUpdateCourse(course.id, { courseType: val as CourseType })}
                                            >
                                                <SelectTrigger className="h-9 border-transparent bg-transparent hover:bg-white hover:border-qc-border-subtle focus:bg-white focus:border-[#563963] focus:ring-2 focus:ring-[#563963]/10 text-xs transition-all text-qc-text-muted">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="Regular">Regular</SelectItem>
                                                    <SelectItem value="Honors">Honors</SelectItem>
                                                    <SelectItem value="AP/IB/Dual">AP/Dual</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        {/* Grade */}
                                        <div className="col-span-1 md:col-span-1">
                                            <Input
                                                value={course.grade}
                                                onChange={(e) => handleUpdateCourse(course.id, { grade: e.target.value })}
                                                placeholder="-"
                                                className="h-9 text-center border-transparent bg-transparent hover:bg-white hover:border-qc-border-subtle focus:bg-white focus:border-[#563963] focus:ring-2 focus:ring-[#563963]/10 transition-all font-semibold text-qc-charcoal"
                                            />
                                        </div>

                                        {/* Credits */}
                                        <div className="col-span-1 md:col-span-1">
                                            <Input
                                                type="number"
                                                step="0.25"
                                                value={course.credits}
                                                onChange={(e) => handleUpdateCourse(course.id, { credits: Number(e.target.value) })}
                                                className="h-9 text-center border-transparent bg-transparent hover:bg-white hover:border-qc-border-subtle focus:bg-white focus:border-[#563963] focus:ring-2 focus:ring-[#563963]/10 transition-all text-qc-text-muted"
                                            />
                                        </div>

                                        {/* Actions */}
                                        <div className="col-span-1 md:col-span-2 flex justify-end pr-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-qc-text-muted hover:text-red-600 hover:bg-red-50"
                                                onClick={() => handleDeleteCourse(course.id)}
                                            >
                                                <Trash size={16} />
                                            </Button>
                                        </div>
                                    </div>

                                    {/* Narrative / Notes Row */}
                                    {settings?.showNarratives && (
                                        <div className="px-1 pb-1 pt-1 ml-1">
                                            <div className="relative">
                                                <div className="absolute left-3 top-2.5 text-qc-border-subtle">
                                                    <FileText size={12} />
                                                </div>
                                                <Input
                                                    value={course.courseNotes || ""}
                                                    onChange={(e) => handleUpdateCourse(course.id, { courseNotes: e.target.value })}
                                                    placeholder="Add course details or teacher comments..."
                                                    className="pl-8 h-8 text-xs border-transparent bg-qc-surface-raised/50 hover:bg-white hover:border-qc-border-subtle focus:bg-white focus:border-[#563963] focus:ring-2 focus:ring-[#563963]/10 transition-all text-qc-text-muted placeholder:text-qc-text-muted"
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </Card>
    );
}

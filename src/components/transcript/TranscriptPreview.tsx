"use client";

import React from "react";
import type { TranscriptData, TestScore } from "./types";
import {
    formatGPA,
    formatCredits,
    calculateAcademicSummary,
    calculateYearSummary,
    formatDateLocal,
    getGradingScaleLegend,
    DEFAULT_GRADING_SCALE
} from "./utils";
import { cn } from "@/lib/utils";

interface TranscriptPreviewProps {
    transcript: TranscriptData;
    className?: string;
}

export function TranscriptPreview({ transcript, className }: TranscriptPreviewProps) {
    const studentName = `${transcript.studentInfo.firstName} ${transcript.studentInfo.middleName || ""} ${transcript.studentInfo.lastName}`.trim();

    // Calculate summaries
    const academicSummary = calculateAcademicSummary(
        transcript.courses.filter(c => c.included !== false),
        transcript.gradingSettings
    );

    const yearSummaries = [9, 10, 11, 12].map(gradeLevel => {
        const yearCourses = transcript.courses.filter(
            c => c.gradeLevel === gradeLevel && c.included !== false
        );
        return calculateYearSummary(gradeLevel, yearCourses, transcript.gradingSettings);
    });

    return (
        <div className={cn("bg-white text-black p-8 shadow-xl border border-qc-border-subtle print:shadow-none max-w-[8.5in] mx-auto min-h-[11in] text-[12px] leading-tight font-serif transition-shadow duration-300", className)}>
            {/* Header */}
            <div className="text-center mb-6 pb-4 border-b-4 border-[#383A57]">
                <h1 className="text-2xl font-bold text-[#383A57] tracking-wider mb-1">OFFICIAL HIGH SCHOOL TRANSCRIPT</h1>
                <h2 className="text-lg font-semibold text-[#563963]">{studentName}</h2>
            </div>

            {/* Info Grid */}
            <div className="grid grid-cols-2 gap-8 mb-6">
                <div className="border-l-4 border-[#563963] pl-4">
                    <div className="font-bold text-[#563963] text-[10px] uppercase tracking-wider mb-2">Student Information</div>
                    <InfoRow label="Name" value={studentName} />
                    {transcript.studentInfo.email && <InfoRow label="Email" value={transcript.studentInfo.email} />}
                    {transcript.studentInfo.gender && <InfoRow label="Gender" value={transcript.studentInfo.gender} />}
                    <InfoRow label="Date of Birth" value={formatDateLocal(transcript.studentInfo.birthDate) || "—"} />
                    {transcript.studentInfo.graduationDate && (
                        <InfoRow label="Graduation Date" value={formatDateLocal(transcript.studentInfo.graduationDate)} />
                    )}
                </div>

                <div className="border-l-4 border-[#563963] pl-4">
                    <div className="font-bold text-[#563963] text-[10px] uppercase tracking-wider mb-2">School Information</div>
                    <InfoRow label="Name" value={transcript.schoolInfo.name} />
                    <InfoRow label="Address" value={transcript.schoolInfo.address} />
                    <InfoRow label="Administrator" value={transcript.schoolInfo.administrator} />
                    {transcript.schoolInfo.email && <InfoRow label="Email" value={transcript.schoolInfo.email} />}
                    {transcript.schoolInfo.phone && <InfoRow label="Phone" value={transcript.schoolInfo.phone} />}
                </div>
            </div>

            {/* Academic Summary Header */}
            <div className="mb-4">
                <div className="flex justify-center items-center border-b border-qc-border-subtle pb-2 gap-8 text-[11px]">
                    <div>
                        <span className="text-qc-text-muted font-medium">Weighted GPA: </span>
                        <span className="font-bold text-[#383A57] text-lg">{formatGPA(academicSummary.weightedGPA)}</span>
                    </div>
                    <div>
                        <span className="text-qc-text-muted font-medium">Unweighted GPA: </span>
                        <span className="font-bold text-[#383A57] text-lg">{formatGPA(academicSummary.unweightedGPA)}</span>
                    </div>
                    <div>
                        <span className="text-qc-text-muted font-medium">Total Credits: </span>
                        <span className="font-bold text-[#383A57] text-lg">{formatCredits(academicSummary.totalCredits)}</span>
                    </div>
                </div>
            </div>

            {/* Course Grid - 2x2 */}
            <div className="grid grid-cols-2 gap-4 mb-6">
                {yearSummaries.map((summary) => (
                    <YearCard key={summary.gradeLevel} summary={summary} showNarratives={transcript.gradingSettings?.showNarratives ?? false} />
                ))}
            </div>

            {/* Test Scores */}
            {transcript.tests?.length > 0 && (
                <div className="mb-6">
                    <SectionTitle>Test Scores</SectionTitle>
                    <div className="grid grid-cols-1 gap-2">
                        {transcript.tests.map((test) => (
                            <div key={test.id} className="border border-qc-border-subtle rounded p-2 bg-white flex flex-col gap-2">
                                <div className="flex justify-between items-center border-b border-qc-border-subtle/50 pb-1">
                                    <span className="font-bold text-[#383A57] text-[11px] uppercase tracking-wide">{test.testType}</span>
                                    {test.date && <span className="text-[10px] text-qc-text-muted">{formatDateLocal(test.date)}</span>}
                                </div>
                                <div className="flex gap-4 flex-wrap text-[11px]">
                                    {Object.entries(test.scores).map(([key, value]) => (
                                        <div key={key} className="flex gap-1">
                                            <span className="text-qc-text-muted font-semibold">{key}:</span>
                                            <span className="font-bold text-[#383A57]">{value}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Grading Scale */}
            <div className="mb-6 bg-[#563963]/5 p-2 rounded border border-qc-border-subtle border-dashed">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[10px]">
                    <span className="font-bold text-[#563963] uppercase tracking-wider">Grading Scale:</span>
                    {(transcript.gradingScale?.length > 0
                        ? transcript.gradingScale
                        : getGradingScaleLegend(transcript.gradingSettings?.scale || '10-point')
                    ).map((scale, i, arr) => (
                        <React.Fragment key={scale.range}>
                            <div className="flex gap-1">
                                <span className="text-qc-charcoal">{scale.range}:</span>
                                <span className="font-bold text-[#383A57]">{scale.points}</span>
                            </div>
                            {i < arr.length - 1 && <span className="text-qc-border-subtle">|</span>}
                        </React.Fragment>
                    ))}
                    {transcript.gradingSettings?.weighted !== false && (
                        <div className="flex gap-1 ml-2 pl-2 border-l border-qc-border-subtle">
                            <span className="text-qc-text-muted italic">(*Weighted GPA includes +0.5/1.0 boost)</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Activities */}
            {transcript.activities?.length > 0 && (
                <div className="mb-6">
                    <SectionTitle>Activities & Awards</SectionTitle>
                    <div className="space-y-3">
                        {transcript.activities.map((activity) => (
                            <div key={activity.id} className="border-l-4 border-[#CCAF60] pl-3 py-2 bg-qc-surface-raised rounded-r border-y border-r border-qc-border-subtle/50">
                                <div className="flex justify-between items-start mb-1">
                                    <span className="font-bold text-[#383A57] text-sm">{activity.title}</span>
                                    <span className="text-[10px] text-qc-text-muted font-medium">{activity.years}</span>
                                </div>
                                {activity.position && (
                                    <div className="text-[11px] text-[#CCAF60] font-bold uppercase tracking-wide mb-1">{activity.position}</div>
                                )}
                                {activity.description && (
                                    <p className="text-[11px] text-qc-charcoal leading-snug mb-1">{activity.description}</p>
                                )}
                                {(activity.hours || activity.awards) && (
                                    <div className="flex gap-4 mt-2 pt-2 border-t border-qc-border-subtle text-[10px] text-qc-text-muted">
                                        {activity.hours && <span><strong>Hours:</strong> {activity.hours}</span>}
                                        {activity.awards && <span className="text-[#CCAF60]"><strong>Awards:</strong> {activity.awards}</span>}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Notes */}
            {transcript.notes?.length > 0 && (
                <div className="mb-6">
                    <SectionTitle>Additional Notes</SectionTitle>
                    <div className="space-y-1">
                        {transcript.notes.map((note) => (
                            <div key={note.id} className="text-[11px] text-qc-charcoal bg-[#CCAF60]/10 border-l-2 border-[#CCAF60] pl-2 py-1">
                                {note.content}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Signature */}
            {transcript.signed && transcript.signature && (
                <div className="mt-8 pt-4 border-t-2 border-[#383A57]">
                    <div className="grid grid-cols-2 gap-8">
                        <div>
                            <div className="font-bold text-[#563963] text-[9px] uppercase tracking-wider mb-2">School Administrator Signature</div>
                            {transcript.signature.type === 'draw' ? (
                                <img src={transcript.signature.data} alt="Signature" className="h-12 border-b-2 border-[#383A57] mb-1" />
                            ) : (
                                <div className="font-script text-xl text-[#383A57] border-b-2 border-[#383A57] pb-1 mb-1 font-cursive" style={{ fontFamily: 'Nothing You Could Do, cursive' }}>{transcript.signature.data}</div>
                            )}
                            <div className="text-[10px] font-bold text-qc-charcoal">Date: {formatDateLocal(transcript.signature.date)}</div>
                        </div>
                        <div className="flex flex-col justify-end text-right">
                            <div className="text-[9px] text-qc-text-muted">Official Transcript generated by Quill & Compass</div>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
    return (
        <div className="text-sm font-bold text-[#563963] uppercase tracking-wider mb-2 pb-1 border-b border-[#563963]/30">
            {children}
        </div>
    );
}

function InfoRow({ label, value, className }: { label: string; value?: string; className?: string }) {
    return (
        <div className="flex items-baseline gap-2 mb-1 text-[11px]">
            <span className="font-bold text-[#383A57] uppercase w-24 shrink-0 text-[10px]">{label}:</span>
            <span className={cn("text-qc-charcoal break-words", className)}>{value || "—"}</span>
        </div>
    );
}

function YearCard({ summary, showNarratives }: { summary: ReturnType<typeof calculateYearSummary>; showNarratives?: boolean }) {
    const sortedCourses = [...summary.courses].sort((a, b) => a.courseName.localeCompare(b.courseName));

    return (
        <div className="border border-qc-border-subtle rounded overflow-hidden flex flex-col h-full bg-white">
            <div className="bg-[#563963]/5 border-b border-qc-border-subtle px-3 py-1.5 flex justify-between items-center">
                <span className="font-bold text-[#563963] text-[11px] uppercase tracking-wider">
                    {summary.yearLabel} {summary.yearRange.start}-{summary.yearRange.end}
                </span>
                <div className="text-[10px] text-qc-text-muted font-medium">
                    <span className="mr-2">GPA: <strong className="text-[#383A57]">{formatGPA(summary.weightedGPA)}</strong></span>
                    <span>Cr: <strong className="text-[#383A57]">{formatCredits(summary.creditTotal)}</strong></span>
                </div>
            </div>

            <div className="p-2 flex-grow">
                {sortedCourses.length === 0 ? (
                    <p className="text-qc-text-muted italic text-[10px] text-center pt-2">No courses recorded</p>
                ) : (
                    <table className="w-full text-[10px]">
                        <thead>
                            <tr className="border-b border-qc-border-subtle">
                                <th className="text-left font-semibold text-[#383A57] pb-1 w-full">Course</th>
                                <th className="text-center font-semibold text-[#383A57] pb-1 w-8">Gr</th>
                                <th className="text-center font-semibold text-[#383A57] pb-1 w-8">Cr</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sortedCourses.map((course, i: number) => (
                                <React.Fragment key={course.id}>
                                    <tr className={cn("border-b border-qc-border-subtle/50 last:border-0", i % 2 !== 0 ? "bg-qc-surface-raised/50" : "")}>
                                        <td className="py-1 pr-2 align-middle text-qc-charcoal leading-tight">
                                            {course.courseName}
                                            {showNarratives && course.courseNotes && (
                                                <div className="text-[9px] text-qc-text-muted italic mt-0.5 leading-snug font-serif">
                                                    {course.courseNotes}
                                                </div>
                                            )}
                                        </td>
                                        <td className="py-1 text-center font-bold text-[#383A57] align-top">{course.grade || "—"}</td>
                                        <td className="py-1 text-center text-qc-text-muted align-top">{formatCredits(course.credits)}</td>
                                    </tr>
                                </React.Fragment>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}

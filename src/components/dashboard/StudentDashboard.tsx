"use client";

import { useEffect, useState } from "react";
import { getStudentAssignments, saveStudentAvatarConfig } from "@/app/actions/student";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, BookOpen, FileText, CheckCircle, Clock, PencilSimple, Users } from "@phosphor-icons/react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { getStudentAvatarUrl } from "@/lib/utils";
import { AvatarCustomizer } from "@/components/profile/AvatarCustomizer";
import { DiscipleshipDashboard } from "@/components/family-discipleship/DiscipleshipDashboard";
import type { StudentDashboardData, StudentAssignmentsData } from "./dashboard-types";

interface StudentDashboardProps {
    student: StudentDashboardData;
    /** Active profile's view mode. Kid-view seam (spec §10); renders STANDARD today. */
    viewMode?: "STANDARD" | "KID";
}

export function StudentDashboard({ student, viewMode = "STANDARD" }: StudentDashboardProps) {
    const [data, setData] = useState<StudentAssignmentsData>({ assignments: [], courseEnrollments: [] });
    const [loading, setLoading] = useState(true);
    const [customizerOpen, setCustomizerOpen] = useState(false);
    const [avatarConfig, setAvatarConfig] = useState(student.avatarConfig);

    useEffect(() => {
        async function loadData() {
            setLoading(true);
            const result = await getStudentAssignments(student.id);
            setData(result);
            setLoading(false);
        }
        loadData();
    }, [student.id]);

    // Kid-view seam (spec §10): the dedicated simplified KID UI will branch here. Today both view
    // modes render the same standard dashboard below — this is the single switch point for it.
    if (viewMode === "KID") {
        // TODO(kid-view): render the dedicated kid UI. For now, fall through to the standard view.
    }

    return (
        <div className="container mx-auto max-w-6xl px-4 py-8">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
                <div className="flex items-center gap-4">
                    <div className="relative group/avatar">
                        <div className="h-24 w-24 rounded-full overflow-hidden ring-4 ring-white shadow-lg bg-qc-parchment-crumpled flex items-center justify-center text-qc-primary">
                            <Avatar className="h-full w-full">
                                <AvatarImage
                                    src={getStudentAvatarUrl(student.preferredName || student.firstName, avatarConfig)}
                                    alt={student.preferredName || student.firstName}
                                    referrerPolicy="no-referrer"
                                />
                                <AvatarFallback className="text-3xl font-bold bg-qc-parchment-crumpled text-qc-primary">
                                    {student.preferredName?.[0] || student.firstName[0]}
                                </AvatarFallback>
                            </Avatar>
                        </div>
                        <Button
                            size="icon"
                            variant="secondary"
                            className="absolute bottom-0 right-0 h-8 w-8 rounded-full shadow-md opacity-0 group-hover/avatar:opacity-100 transition-opacity"
                            onClick={() => setCustomizerOpen(true)}
                        >
                            <PencilSimple size={16} />
                        </Button>
                    </div>
                    <div>
                        <h1 className="font-display text-4xl font-bold text-qc-charcoal text-balance">
                            {student.preferredName || student.firstName}&apos;s Dashboard
                        </h1>
                        <p className="font-body text-lg text-qc-text-muted qc-prose">
                            Let&apos;s see what we&apos;re learning today!
                        </p>
                    </div>
                </div>
            </div>

            {loading ? (
                <div className="flex h-64 items-center justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-qc-primary"></div>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Courses Section */}
                    <section aria-label="My courses" className="space-y-6">
                        <h2 className="font-display text-2xl font-bold text-qc-charcoal flex items-center gap-2 text-balance">
                            <BookOpen size={24} className="text-qc-primary" />
                            My Courses
                        </h2>

                        {data.courseEnrollments.length === 0 ? (
                            <Card>
                                <CardContent className="py-8 text-center text-qc-text-muted">
                                    <p>You haven&apos;t been enrolled in any courses yet.</p>
                                </CardContent>
                            </Card>
                        ) : (
                            <div className="space-y-4">
                                {data.courseEnrollments.map((enrollment) => (
                                    <Link key={enrollment.courseId} href={`/courses/${enrollment.courseId}/learn`} className="block group">
                                        <Card className="transition-all duration-300 group-hover:shadow-md group-hover:border-qc-primary/50">
                                            <CardContent className="p-5 flex items-start justify-between">
                                                <div>
                                                    <h3 className="font-display text-xl font-bold text-qc-charcoal group-hover:text-qc-primary transition-colors text-balance">
                                                        {enrollment.course.title}
                                                    </h3>
                                                    <p className="text-sm text-qc-text-muted mb-2">{enrollment.course.subject?.name}</p>
                                                    <div className="flex gap-2">
                                                        <Badge variant={enrollment.status === 'COMPLETED' ? 'secondary' : 'default'}>
                                                            {enrollment.status}
                                                        </Badge>
                                                    </div>
                                                </div>
                                                <div className="h-10 w-10 flex items-center justify-center rounded-full bg-qc-parchment group-hover:bg-qc-primary group-hover:text-white transition-colors">
                                                    <ArrowLeft size={20} className="rotate-180" />
                                                </div>
                                            </CardContent>
                                        </Card>
                                    </Link>
                                ))}
                            </div>
                        )}
                    </section>

                    {/* Assignments Section */}
                    <section aria-label="Assignments and resources" className="space-y-6">
                        <h2 className="font-display text-2xl font-bold text-qc-charcoal flex items-center gap-2 text-balance">
                            <FileText size={24} className="text-qc-primary" />
                            Assignments & Resources
                        </h2>

                        {data.assignments.length === 0 ? (
                            <Card>
                                <CardContent className="py-8 text-center text-qc-text-muted">
                                    <p>No individual assignments right now.</p>
                                </CardContent>
                            </Card>
                        ) : (
                            <div className="space-y-4">
                                {data.assignments.map((assignment) => (
                                    <Card key={assignment.id} className="cursor-pointer hover:shadow-md transition-shadow">
                                        <CardContent className="p-5">
                                            <div className="flex gap-4">
                                                <div className="h-12 w-12 rounded-qc-md bg-qc-info-bg flex items-center justify-center text-qc-info-text shrink-0">
                                                    <FileText size={24} />
                                                </div>
                                                <div>
                                                    <h3 className="font-display text-lg font-bold text-qc-charcoal text-balance">
                                                        {assignment.resource.title}
                                                    </h3>
                                                    <p className="text-sm text-qc-text-muted">
                                                        {assignment.resource.resourceKind?.label || "Resource"}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="mt-4 flex justify-end">
                                                <Button size="sm" variant="outline" asChild>
                                                    <Link href={`/living-library/resource/${assignment.resource.id}`}>Open Resource</Link>
                                                </Button>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        )}
                    </section>
                </div>
            )}

            {/* Family Discipleship Section */}
            {!loading && (
                <section aria-label="Family discipleship" className="mt-12 space-y-6">
                    <h2 className="font-display text-2xl font-bold text-qc-charcoal flex items-center gap-2 text-balance">
                        <Users size={24} className="text-qc-primary" />
                        Family Discipleship
                    </h2>
                    <DiscipleshipDashboard studentId={student.id} />
                </section>
            )}

            <AvatarCustomizer
                open={customizerOpen}
                onOpenChange={setCustomizerOpen}
                studentId={student.id}
                initialName={student.preferredName || student.firstName}
                initialConfig={avatarConfig}
                onSave={async (newConfig) => {
                    const res = await saveStudentAvatarConfig(student.id, newConfig);
                    if (res.success) setAvatarConfig(newConfig);
                    return { ok: res.success };
                }}
            />
        </div>
    );
}

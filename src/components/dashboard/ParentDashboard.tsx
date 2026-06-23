import { MathOperations, NotePencil, Camera } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ContextCompleteness } from "@/components/context/ContextCompleteness";
import { InklingToolkit } from "@/components/navigation/InklingToolkit";
import { AssignResourceDialog } from "@/components/assignments/AssignResourceDialog";
import { MyLearningCard } from "./MyLearningCard";
import type { MyLearning } from "@/server/profiles/my-learning";

export interface ParentDashboardProps {
    students: any[];
    recentResources: any[];
    recentCourses: any[];
    completeness: any;
    suggestions: any;
    classroomName: string;
    myLearning: MyLearning;
    todayDevotional?: { reference: string; excerpt: string } | null;
}

export function ParentDashboard({
    students,
    recentResources,
    recentCourses,
    completeness,
    suggestions,
    classroomName,
    myLearning,
    todayDevotional,
}: ParentDashboardProps) {
    const pageTitle = classroomName || "My Classroom";

    return (
        <div className="container mx-auto max-w-6xl px-4 py-8">
            <div className="mb-8 flex flex-col items-center text-center">
                <h1 className="font-display text-4xl font-bold text-qc-charcoal mb-2 text-balance">
                    {pageTitle}
                </h1>
                <p className="font-body text-lg text-qc-text-muted qc-prose">
                    Overview of your educational platform
                </p>
            </div>

            {/* Daily Liturgy & Quick Actions */}
            <section aria-label="Daily overview" className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                {/* Active Liturgy Card */}
                <Card className="lg:col-span-2 border-l-4 border-l-qc-primary shadow-md bg-gradient-to-br from-white to-qc-parchment">
                    <CardHeader className="pb-3">
                        <CardTitle className="font-display text-xl text-qc-primary">Daily Liturgy</CardTitle>
                        <CardDescription>Today's family discipleship focus</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="p-4 bg-qc-parchment rounded-lg border border-qc-border-subtle flex items-start justify-between">
                            <div>
                                <span className="text-xs font-bold uppercase tracking-wider text-qc-text-muted">Morning Reading</span>
                                <h3 className="font-display text-lg font-bold text-qc-charcoal mt-1 text-balance">
                                    {todayDevotional?.reference ?? "Psalm 23: The Shepherd"}
                                </h3>
                                <p className="text-sm text-qc-text-muted mt-2 line-clamp-2">
                                    {todayDevotional?.excerpt ?? "\"The Lord is my shepherd; I shall not want...\""}
                                </p>
                            </div>
                            <Button size="sm" asChild>
                                <Link href="/family-discipleship/devotionals">Start</Link>
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {/* One-Tap Generators */}
                <Card className="bg-gradient-to-br from-white to-qc-parchment">
                    <CardHeader className="pb-3">
                        <CardTitle className="font-display text-xl">Quick Create</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        <Button variant="outline" className="w-full justify-start gap-2 bg-white" asChild>
                            <Link href="/creation-station?sourceType=TOPIC&topicText=Math%20Quiz">
                                <MathOperations size={20} /> Math Quiz
                            </Link>
                        </Button>
                        <Button variant="outline" className="w-full justify-start gap-2 bg-white" asChild>
                            <Link href="/creation-station?sourceType=TOPIC&topicText=Spelling%20List">
                                <NotePencil size={20} /> Spelling List
                            </Link>
                        </Button>
                        <Button variant="outline" className="w-full justify-start gap-2 bg-white" asChild>
                            <Link href="/living-library/scan">
                                <Camera size={20} /> Scan Book
                            </Link>
                        </Button>
                    </CardContent>
                </Card>
            </section>

            {/* Inkling Toolkit Navigation */}
            <Card className="mb-8 border-2 border-qc-primary/10 shadow-sm bg-gradient-to-br from-white to-qc-parchment">

                <CardContent className="py-6">
                    <InklingToolkit />
                </CardContent>
            </Card>

            {/* My Learning (parent-as-learner, spec §9) — additive; appears for the active parent profile. */}
            <MyLearningCard myLearning={myLearning} />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                {/* Context Completeness */}
                <div className="lg:col-span-2">
                    <ContextCompleteness completeness={completeness} suggestions={suggestions} />
                </div>

                {/* Quick Actions */}
                <Card className="bg-gradient-to-br from-white to-qc-parchment">
                    <CardHeader>
                        <CardTitle className="font-display text-lg">Quick Actions</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        <Button className="w-full justify-start" asChild>
                            <Link href="/creation-station">Generate Content</Link>
                        </Button>
                        <Button variant="outline" className="w-full justify-start" asChild>
                            <Link href="/courses/new">Create Course</Link>
                        </Button>
                        <Button variant="outline" className="w-full justify-start" asChild>
                            <Link href="/living-library/scan">Scan Book</Link>
                        </Button>
                        <Button variant="outline" className="w-full justify-start" asChild>
                            <Link href="/students">Manage Students</Link>
                        </Button>
                        <Button variant="outline" className="w-full justify-start" asChild>
                            <Link href="/blueprint">View Blueprint</Link>
                        </Button>
                    </CardContent>
                </Card>
            </div>

            <section aria-label="Recent activity" className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Recent Resources */}
                <Card className="bg-gradient-to-br from-white to-qc-parchment">
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle className="font-display text-lg">Recent Resources</CardTitle>
                                <CardDescription>Recently generated content</CardDescription>
                            </div>
                            <Button variant="outline" size="sm" asChild>
                                <Link href="/resources">View All</Link>
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent>
                        {recentResources.length === 0 ? (
                            <p className="font-body text-sm text-qc-text-muted text-center py-4">
                                No resources yet. Generate some content to get started.
                            </p>
                        ) : (
                            <div className="space-y-3">
                                {recentResources.map((resource) => (
                                    <div
                                        key={resource.id}
                                        className="p-3 bg-qc-parchment rounded-qc-md border border-qc-border-subtle flex items-start justify-between group"
                                    >
                                        <div>
                                            <p className="font-body text-sm font-medium text-qc-charcoal">
                                                {resource.title}
                                            </p>
                                            <p className="font-body text-xs text-qc-text-muted mt-1">
                                                {resource.resourceKind.label} •{" "}
                                                {new Date(resource.createdAt).toLocaleDateString()}
                                            </p>
                                        </div>
                                        <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                                            <AssignResourceDialog
                                                resourceId={resource.id}
                                                resourceTitle={resource.title}
                                                students={students}
                                                type="RESOURCE"
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Recent Courses */}
                <Card className="bg-gradient-to-br from-white to-qc-parchment">
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle className="font-display text-lg">Recent Courses</CardTitle>
                                <CardDescription>Your course activity</CardDescription>
                            </div>
                            <Button variant="outline" size="sm" asChild>
                                <Link href="/courses">View All</Link>
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent>
                        {recentCourses.length === 0 ? (
                            <p className="font-body text-sm text-qc-text-muted text-center py-4">
                                No courses yet. Create your first course to get started.
                            </p>
                        ) : (
                            <div className="space-y-3">
                                {recentCourses.map((course) => (
                                    <div
                                        key={course.id}
                                        className="p-3 bg-qc-parchment rounded-qc-md border border-qc-border-subtle"
                                    >
                                        <div className="flex items-start justify-between">
                                            <div className="flex-1">
                                                <p className="font-body text-sm font-medium text-qc-charcoal">
                                                    {course.title}
                                                </p>
                                                <p className="font-body text-xs text-qc-text-muted mt-1">
                                                    {course.subject.name}
                                                    {course.students.length > 0 &&
                                                        ` • ${course.students.length} student${course.students.length !== 1 ? "s" : ""}`}
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <AssignResourceDialog
                                                    resourceId={course.id}
                                                    resourceTitle={course.title}
                                                    students={students}
                                                    type="COURSE"
                                                />
                                                <Button variant="outline" size="sm" asChild>
                                                    <Link href={`/courses/${course.id}/builder`}>View</Link>
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </section>
        </div>
    );
}

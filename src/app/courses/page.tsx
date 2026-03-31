import { auth } from "@/auth";
import { getCurrentUserOrg } from "@/lib/auth-helpers";
import { db } from "@/server/db";
import { Prisma } from "@/generated/client";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Plus, BookOpen, GraduationCap } from "@phosphor-icons/react/dist/ssr";
import { cacheQuery } from "@/lib/utils/prisma-cache";

function formatDate(date: Date) {
    try {
        return new Intl.DateTimeFormat("en-US", {
            month: "long",
            day: "numeric",
            year: "numeric",
        }).format(new Date(date));
    } catch {
        return "Unknown Date";
    }
}

// Converted from include to select for precise field selection
const courseSelect = {
    id: true,
    title: true,
    description: true,
    updatedAt: true,
    createdAt: true,
    subject: {
        select: {
            id: true,
            name: true,
            code: true,
        },
    },
    gradeBand: {
        select: {
            id: true,
            code: true,
            name: true,
        },
    },
    strand: {
        select: {
            id: true,
            name: true,
            code: true,
        },
    },
    _count: {
        select: {
            students: true,
            blocks: true,
        },
    },
} satisfies Prisma.CourseSelect;

const getOrganizationCourses = cacheQuery(
    async (organizationId: string) => {
        return db.course.findMany({
            where: {
                organizationId,
            },
            select: courseSelect,
            orderBy: {
                updatedAt: "desc",
            },
            take: 100, // Explicit bound - organizations shouldn't have hundreds of active courses
        }) as unknown as Promise<Prisma.CourseGetPayload<{ select: typeof courseSelect }>[]>;
    },
    ["organization-courses"],
    {
        revalidate: 60,
        tags: ["courses"]
    }
);

export default async function CoursesIndexPage() {
    // 1. Check Session
    const session = await auth();
    if (!session?.user) {
        redirect("/login");
    }

    // 2. Refresh User Data from DB
    // Session might be stale (e.g. orgId missing immediately after creating it)
    let userOrg;
    try {
        userOrg = await getCurrentUserOrg(session);
    } catch (error) {
        // User not found in DB or other auth error
        redirect("/login");
    }

    const { organizationId } = userOrg;

    // 3. Check Organization
    if (!organizationId) {
        redirect("/onboarding");
    }

    const courses = await getOrganizationCourses(organizationId);

    return (
        <div className="container mx-auto py-8">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-display font-bold text-qc-charcoal text-balance">Courses</h1>
                    <p className="text-qc-text-muted mt-1 qc-prose">Manage your curriculum and class materials</p>
                </div>
                <Button asChild>
                    <Link href="/courses/new" className="gap-2">
                        <Plus size={16} />
                        Create Course
                    </Link>
                </Button>
            </div>

            {courses.length === 0 ? (
                <div className="text-center py-16 bg-qc-parchment rounded-xl border border-dashed border-qc-border-subtle">
                    <BookOpen size={48} className="text-qc-text-muted mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-qc-charcoal mb-2">No courses yet</h3>
                    <p className="text-qc-text-muted mb-6 max-w-sm mx-auto">
                        Get started by creating your first course to organize lessons, assignments, and resources.
                    </p>
                    <Button asChild>
                        <Link href="/courses/new">Create Course</Link>
                    </Button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {courses.map((course) => (
                        <Link key={course.id} href={`/courses/${course.id}`}>
                            <Card className="h-full hover:shadow-lg transition-shadow cursor-pointer group">
                                <CardHeader>
                                    <div className="flex items-start justify-between">
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2">
                                                <span className="px-2 py-0.5 rounded-full bg-qc-primary/10 text-qc-primary text-xs font-semibold uppercase tracking-wider">
                                                    {course.subject.code}
                                                </span>
                                                {course.gradeBand && (
                                                    <span className="px-2 py-0.5 rounded-full bg-qc-accent/10 text-qc-accent text-xs font-medium">
                                                        {course.gradeBand.code}
                                                    </span>
                                                )}
                                            </div>
                                            <CardTitle className="font-display text-xl group-hover:text-qc-primary transition-colors">
                                                {course.title}
                                            </CardTitle>
                                        </div>
                                    </div>
                                    <CardDescription className="line-clamp-2">
                                        {course.description || "No description provided."}
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="flex items-center gap-4 text-sm text-qc-text-muted">
                                        <div className="flex items-center gap-1">
                                            <GraduationCap size={16} />
                                            <span>{course._count.students} Students</span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <BookOpen size={16} />
                                            <span>{course._count.blocks} Units</span>
                                        </div>
                                    </div>
                                </CardContent>
                                <CardFooter className="text-xs text-qc-text-muted border-t pt-4">
                                    Last updated {formatDate(course.updatedAt)}
                                </CardFooter>
                            </Card>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
}

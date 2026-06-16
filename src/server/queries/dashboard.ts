import "server-only";
import { db } from "@/server/db";
import { setRlsContext } from "@/server/rls-context";
import { analyzeContextCompleteness } from "@/lib/context/context-suggestions";

export async function getStudentDashboardData(organizationId: string, studentId: string) {
    // RLS: set the tenant context in THIS frame (same async frame as the queries below), since
    // getCurrentUserOrg's context doesn't propagate back to the page's queries across frames.
    setRlsContext({ organizationId, userId: null });
    return db.student.findUnique({
        where: {
            id: studentId,
            organizationId,
        },
        select: {
            id: true,
            firstName: true,
            lastName: true,
            preferredName: true,
            currentGrade: true,
            avatarConfig: true,
            learnerProfile: {
                select: {
                    id: true,
                    personalityData: true,
                    learningStyleData: true,
                    interestsData: true,
                },
            },
        },
    });
}

export async function getParentDashboardData(organizationId: string) {
    setRlsContext({ organizationId, userId: null });

    // 1. Context Completeness
    const { completeness, suggestions } = await analyzeContextCompleteness(organizationId);

    // 2. Recent Resources
    // We explicitly select fields to match the UI requirements and avoid over-fetching
    const recentResources = await db.resource.findMany({
        where: { organizationId },
        select: {
            id: true,
            title: true,
            createdAt: true,
            resourceKind: {
                select: {
                    id: true,
                    label: true,
                    code: true,
                },
            },
            createdByUser: {
                select: {
                    id: true,
                    name: true,
                },
            },
        },
        orderBy: { createdAt: "desc" },
        take: 5,
    });

    // 3. Recent Courses
    const recentCourses = await db.course.findMany({
        where: { organizationId },
        select: {
            id: true,
            title: true,
            updatedAt: true,
            subject: {
                select: {
                    id: true,
                    name: true,
                },
            },
            students: {
                select: {
                    student: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                            preferredName: true,
                        },
                    },
                },
            },
        },
        orderBy: { updatedAt: "desc" },
        take: 5,
    });

    // 4. All Students (for the switcher)
    const students = await db.student.findMany({
        where: { organizationId },
        select: {
            id: true,
            firstName: true,
            lastName: true,
            preferredName: true,
            avatarConfig: true,
            learnerProfile: {
                select: {
                    id: true,
                },
            },
        },
        take: 10,
    });

    // 5. Classroom Name
    const classroom = await db.classroom.findFirst({
        where: { organizationId },
        orderBy: { createdAt: "desc" },
        select: { name: true },
    });

    return {
        completeness,
        suggestions,
        recentResources,
        recentCourses,
        students,
        classroomName: classroom?.name,
    };
}

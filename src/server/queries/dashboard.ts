import "server-only";
import { withTenant } from "@/server/db";
import { analyzeContextCompleteness } from "@/lib/context/context-suggestions";

export async function getStudentDashboardData(organizationId: string, studentId: string) {
    // RLS: run inside a transaction with the tenant GUCs stamped on the connection from the
    // EXPLICIT org (no AsyncLocalStorage / no extension — those don't reach the query layer in
    // the Next runtime). All reads use `tx`.
    return withTenant(
        (tx) =>
            tx.learner.findUnique({
                where: { id: studentId, organizationId },
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
            }),
        undefined,
        { organizationId, userId: null },
    );
}

export async function getParentDashboardData(organizationId: string) {
    // NOTE: analyzeContextCompleteness still queries via `db`; it is not yet tenant-threaded, so
    // under RLS it returns empty until the full rollout. The student list (the thing that
    // "disappeared") comes from the explicit-tx path below and is the real test.
    const { completeness, suggestions } = await analyzeContextCompleteness(organizationId);

    return withTenant(
        async (tx) => {
            const recentResources = await tx.resource.findMany({
                where: { organizationId },
                select: {
                    id: true,
                    title: true,
                    createdAt: true,
                    resourceKind: { select: { id: true, label: true, code: true } },
                    createdByUser: { select: { id: true, name: true } },
                },
                orderBy: { createdAt: "desc" },
                take: 5,
            });

            const recentCourses = await tx.course.findMany({
                where: { organizationId },
                select: {
                    id: true,
                    title: true,
                    updatedAt: true,
                    subject: { select: { id: true, name: true } },
                    students: {
                        select: {
                            student: {
                                select: { id: true, firstName: true, lastName: true, preferredName: true },
                            },
                        },
                    },
                },
                orderBy: { updatedAt: "desc" },
                take: 5,
            });

            const students = await tx.learner.findMany({
                where: { organizationId },
                select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    preferredName: true,
                    avatarConfig: true,
                    learnerProfile: { select: { id: true } },
                },
                take: 10,
            });

            const classroom = await tx.classroom.findFirst({
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
        },
        undefined,
        { organizationId, userId: null },
    );
}

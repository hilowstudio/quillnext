"use server";

import { db } from "@/server/db";
import { getCurrentUserOrg } from "@/lib/auth-helpers";

// The student must belong to the caller's organization (throws otherwise).
async function assertStudentInOrg(studentId: string) {
    const { organizationId } = await getCurrentUserOrg(); // throws if unauthenticated
    const s = await db.student.findUnique({ where: { id: studentId }, select: { organizationId: true } });
    if (!s || s.organizationId !== organizationId) throw new Error("Unauthorized");
}

export async function getStudentAssignments(studentId: string) {
    if (!studentId) {
        throw new Error("Student ID is required");
    }
    await assertStudentInOrg(studentId);

    const assignments = await db.resourceAssignment.findMany({
        where: { studentId },
        select: {
            id: true,
            studentId: true,
            createdAt: true,
            status: true,
            dueDate: true,
            completedAt: true,
            courseId: true,
            activityId: true,
            resource: {
                select: {
                    id: true,
                    title: true,
                    resourceKind: {
                        select: {
                            id: true,
                            label: true,
                            code: true,
                        },
                    },
                },
            },
            course: {
                select: {
                    id: true,
                    title: true,
                },
            },
            activity: {
                select: {
                    id: true,
                    title: true,
                    activityType: true,
                },
            },

        },
        orderBy: { createdAt: "desc" },
        take: 50, // Explicit bound to prevent unbounded queries
    });

    const courseEnrollments = await db.courseStudent.findMany({
        where: { studentId },
        select: {
            courseId: true,
            studentId: true,
            enrolledAt: true,
            status: true,
            course: {
                select: {
                    id: true,
                    title: true,
                    subject: {
                        select: {
                            id: true,
                            name: true,
                            code: true,
                        },
                    },
                },
            },
        },
        orderBy: { enrolledAt: "desc" },
        take: 20, // Explicit bound
    });

    return { assignments, courseEnrollments };
}

export async function saveStudentAvatarConfig(studentId: string, config: any) {
    await assertStudentInOrg(studentId);

    await db.student.update({
        where: { id: studentId },
        data: { avatarConfig: config },
    });

    return { success: true };
}

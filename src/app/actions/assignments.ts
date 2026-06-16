"use server";

import { db } from "@/server/db";
import { getCurrentUserOrg } from "@/lib/auth-helpers";
import { revalidatePath } from "next/cache";

export async function assignResourceToStudent(resourceId: string, studentId: string, type: 'RESOURCE' | 'COURSE' = 'RESOURCE') {
    const { userId, organizationId } = await getCurrentUserOrg(); // throws if unauthenticated
    if (!organizationId) throw new Error("No organization found");

    // The student must belong to the caller's org.
    const student = await db.student.findUnique({ where: { id: studentId }, select: { organizationId: true } });
    if (!student || student.organizationId !== organizationId) throw new Error("Unauthorized");

    if (type === 'COURSE') {
        // resourceId is a courseId here — it must belong to the caller's org.
        const course = await db.course.findUnique({ where: { id: resourceId }, select: { organizationId: true } });
        if (!course || course.organizationId !== organizationId) throw new Error("Unauthorized");

        const existing = await db.courseStudent.findUnique({
            where: {
                courseId_studentId: {
                    courseId: resourceId,
                    studentId: studentId
                }
            }
        });

        if (!existing) {
            await db.courseStudent.create({
                data: {
                    courseId: resourceId,
                    studentId: studentId,
                    status: 'ACTIVE'
                }
            });
        }
    } else {
        // The resource being assigned must belong to the caller's org.
        const resource = await db.resource.findUnique({ where: { id: resourceId }, select: { organizationId: true } });
        if (!resource || resource.organizationId !== organizationId) throw new Error("Unauthorized");

        await db.resourceAssignment.create({
            data: {
                resourceId,
                assignedByUserId: userId,
                student: {
                    connect: { id: studentId }
                }
            } as any,
        });
    }

    revalidatePath("/");
    revalidatePath("/students");
    return { success: true };
}

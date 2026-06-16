"use server";

import { db } from "@/server/db";
import { getCurrentUserOrg } from "@/lib/auth-helpers";
import { revalidatePath } from "next/cache";

/**
 * Create a gradeable attempt for a student on an assessment.
 *
 * This is the minimal "a submission exists to grade" path: it seeds the attempt
 * as SUBMITTED with one (blank) response per item, so the existing grading UI at
 * /grading/[id] becomes reachable. A full student-facing assessment-taking flow
 * (capturing real responses) is a separate, larger feature.
 */
export async function createAssessmentAttempt(assessmentId: string, studentId: string) {
    const { organizationId } = await getCurrentUserOrg(); // throws if unauthenticated
    if (!organizationId) throw new Error("No organization found");

    // The assessment (via its course) must belong to the caller's org.
    const assessment = await db.assessment.findUnique({
        where: { id: assessmentId },
        include: {
            course: { select: { organizationId: true } },
            items: { select: { id: true, points: true } },
        },
    });
    if (!assessment || assessment.course.organizationId !== organizationId) {
        throw new Error("Unauthorized");
    }

    // The student must belong to the caller's org.
    const student = await db.student.findUnique({ where: { id: studentId }, select: { organizationId: true } });
    if (!student || student.organizationId !== organizationId) {
        throw new Error("Unauthorized");
    }

    const attempt = await db.assessmentAttempt.create({
        data: {
            assessmentId,
            studentId,
            status: "SUBMITTED",
            submittedAt: new Date(),
            maxPoints: assessment.totalPoints ?? undefined,
            itemResponses: {
                create: assessment.items.map((item) => ({
                    itemId: item.id,
                    responseData: {},
                    pointsPossible: item.points,
                })),
            },
        },
    });

    revalidatePath("/grading");
    return { success: true, attemptId: attempt.id };
}

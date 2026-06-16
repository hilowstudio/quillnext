"use server";

import { db } from "@/server/db";
import { auth } from "@/auth";
import type { TranscriptData, TranscriptCourse, StudentInfo, SchoolInfo } from "@/components/transcript/types";
import { DEFAULT_GRADING_SCALE } from "@/components/transcript/utils";
import { getCurrentUserOrg } from "@/lib/auth-helpers";
import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/client";

// Define the type we expect from the detailed student fetch
type StudentWithDetails = Prisma.StudentGetPayload<{
    include: {
        organization: true,
        classroomEnrollments: {
            include: {
                classroom: true
            }
        },
        courseEnrollments: {
            include: {
                course: true
            }
        }
    }
}>;

// The student must belong to the caller's organization (throws otherwise).
async function assertStudentInOrg(studentId: string, organizationId: string | null) {
    if (!organizationId) throw new Error("Organization not found for user");
    const s = await db.student.findUnique({ where: { id: studentId }, select: { organizationId: true } });
    if (!s || s.organizationId !== organizationId) throw new Error("Unauthorized");
}

/**
 * Generate initial transcript data for a student
 * Pulls from Student, Organization, and Course/CourseStudent tables
 */
export async function generateTranscriptData(studentId: string): Promise<TranscriptData> {
    const session = await auth();
    if (!session?.user?.id) throw new Error("Not authenticated");
    const { organizationId } = await getCurrentUserOrg(session);

    const student = await db.student.findUnique({
        where: { id: studentId },
        include: {
            organization: true,
            classroomEnrollments: {
                take: 1,
                orderBy: { enrolledAt: 'desc' },
                include: {
                    classroom: true
                }
            },
            courseEnrollments: {
                include: {
                    course: true
                }
            }
        }
    }) as unknown as StudentWithDetails | null;

    if (!student) throw new Error("Student not found");
    // Multi-tenant guard.
    if (!organizationId || student.organizationId !== organizationId) throw new Error("Student not found");

    // Determine grade level
    let gradeLevel = 9;
    const currentGrade = student.currentGrade?.toLowerCase();
    if (currentGrade?.includes("9")) gradeLevel = 9;
    else if (currentGrade?.includes("10")) gradeLevel = 10;
    else if (currentGrade?.includes("11")) gradeLevel = 11;
    else if (currentGrade?.includes("12")) gradeLevel = 12;

    // Map courses
    const transcriptCourses: TranscriptCourse[] = student.courseEnrollments.map(enrollment => {
        let level = gradeLevel;

        return {
            id: `course-${enrollment.courseId}`,
            courseName: enrollment.course.title,
            subject: "General",
            grade: "",
            credits: 1,
            courseType: "Regular",
            gradeLevel: level,
            included: true,
            studentId: student.id,
        };
    });

    const studentInfo: StudentInfo = {
        firstName: student.firstName,
        lastName: student.lastName || "",
        gender: student.sex ? (student.sex === "MALE" ? "Male" : "Female") : undefined,
        birthDate: student.birthdate ? student.birthdate.toISOString() : undefined,
        studentId: student.id,
    };

    // Prefer classroom name (from Blueprint), fallback to organization name
    const classroomName = student.classroomEnrollments[0]?.classroom?.name;
    const schoolName = classroomName || student.organization.name || "My School";

    const schoolInfo: SchoolInfo = {
        name: schoolName,
        address: "",
        administrator: session.user.name || "",
        email: session.user.email || "",
    };

    return {
        name: `Transcript for ${student.firstName}`,
        template: "year-based",
        studentInfo,
        schoolInfo,
        courses: transcriptCourses,
        pre9thCourses: [],
        tests: [],
        activities: [],
        notes: [],
        gradingScale: DEFAULT_GRADING_SCALE,
        signed: false,
    };
}

/**
 * Save a transcript
 */
export async function saveTranscript(studentId: string, data: TranscriptData, transcriptId?: string) {
    const session = await auth();
    if (!session?.user?.id) throw new Error("Not authenticated");
    const { organizationId } = await getCurrentUserOrg(session);
    if (!organizationId) throw new Error("Organization not found for user");

    // The student must be in the caller's org, and (if updating) so must the transcript.
    await assertStudentInOrg(studentId, organizationId);
    if (transcriptId) {
        const existing = await db.transcript.findUnique({ where: { id: transcriptId }, select: { organizationId: true } });
        if (!existing || existing.organizationId !== organizationId) throw new Error("Unauthorized");
    }

    const transcript = await db.transcript.upsert({
        where: { id: transcriptId || "new" },
        create: {
            studentId,
            organizationId,
            name: data.name,
            data: data as any,
        },
        update: {
            name: data.name,
            data: data as any,
        }
    });

    revalidatePath("/transcripts");
    return transcript;
}

/**
 * Get all transcripts for a student
 */
export async function getTranscripts(studentId: string) {
    const session = await auth();
    if (!session?.user?.id) throw new Error("Not authenticated");
    const { organizationId } = await getCurrentUserOrg(session);
    await assertStudentInOrg(studentId, organizationId);

    const transcripts = await db.transcript.findMany({
        where: { studentId, organizationId: organizationId! },
        orderBy: { updatedAt: "desc" }
    });

    return transcripts.map(t => ({
        ...t,
        data: t.data as unknown as TranscriptData
    }));
}

/**
 * Delete a transcript
 */
export async function deleteTranscript(transcriptId: string) {
    const session = await auth();
    if (!session?.user?.id) throw new Error("Not authenticated");
    const { organizationId } = await getCurrentUserOrg(session);
    if (!organizationId) throw new Error("Organization not found for user");

    const existing = await db.transcript.findUnique({ where: { id: transcriptId }, select: { organizationId: true } });
    if (!existing || existing.organizationId !== organizationId) throw new Error("Unauthorized");

    await db.transcript.delete({
        where: { id: transcriptId }
    });

    revalidatePath("/transcripts");
}

import { cache } from "react";
import { Prisma } from "@/generated/client";
import { db, withTenant } from "@/server/db";
import { getMasterContext } from "@/lib/context/master-context";

/**
 * Precise select configuration for student queries
 * Only fetches fields that are actually displayed in the UI
 */
const studentSelect = {
    id: true,
    firstName: true,
    lastName: true,
    preferredName: true,
    currentGrade: true,
    birthdate: true,
    learningDifficulties: true,
    avatarConfig: true,
    organizationId: true,
    learnerProfile: {
        select: {
            id: true,
            personalityData: true,
            learningStyleData: true,
            interestsData: true,
        },
    },
    courseEnrollments: {
        select: {
            courseId: true,
            studentId: true,
            status: true,
            enrolledAt: true,
            course: {
                select: {
                    id: true,
                    title: true,
                    subjectId: true,
                    strandId: true,
                    subject: {
                        select: {
                            id: true,
                            name: true,
                            code: true,
                        },
                    },
                    strand: {
                        select: {
                            id: true,
                            name: true,
                            code: true,
                        },
                    },
                },
            },
        },
    },
    activityProgress: {
        select: {
            id: true,
            status: true,
            startedAt: true,
            completedAt: true,
            updatedAt: true,
            activity: {
                select: {
                    id: true,
                    title: true,
                    activityType: true,
                },
            },
        },
        take: 10,
        orderBy: { updatedAt: "desc" },
    },
    courseProgress: {
        select: {
            id: true,
            courseId: true,
            overallCompletionPercentage: true,
            lastActivityAt: true,
        },
    },
    personalizedResources: {
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
        },
        take: 5,
        orderBy: { createdAt: "desc" },
    },
} satisfies Prisma.StudentSelect;

export type StudentWithRelations = Prisma.StudentGetPayload<{
    select: typeof studentSelect;
}>;

const objectiveSelect = {
    id: true,
    code: true,
    text: true,
    complexity: true,
    gradeLevel: true,
    sortOrder: true,
    subtopic: {
        select: {
            id: true,
            code: true,
            name: true,
            topic: {
                select: {
                    id: true,
                    code: true,
                    name: true,
                    strand: {
                        select: {
                            id: true,
                            code: true,
                            name: true,
                            subject: {
                                select: {
                                    id: true,
                                    code: true,
                                    name: true,
                                },
                            },
                        },
                    },
                },
            },
        },
    },
} satisfies Prisma.ObjectiveSelect;

export type ObjectiveWithRelations = Prisma.ObjectiveGetPayload<{
    select: typeof objectiveSelect;
}>;

const bookSelect = {
    id: true,
    title: true,
    authors: true,
    summary: true,
    subject: {
        select: {
            id: true,
            name: true,
            code: true,
        },
    },
    strand: {
        select: {
            id: true,
            name: true,
            code: true,
        },
    },
} satisfies Prisma.BookSelect;

export type BookWithRelations = Prisma.BookGetPayload<{
    select: typeof bookSelect;
}>;


/**
 * Fetches a student by ID with precise field selection
 * Returns null if student not found or doesn't match the organization
 * 
 * Uses React cache() for request-level deduplication
 */
export const getStudentById = cache(async (studentId: string, organizationId: string) => {
    const student = await withTenant(
        (tx) =>
            tx.student.findUnique({
                where: { id: studentId },
                select: studentSelect,
            }),
        undefined,
        { organizationId, userId: null }
    );

    // Verify student belongs to the organization
    if (!student || student.organizationId !== organizationId) {
        return null;
    }

    return student;
});

/**
 * Fetches the master context for a student
 * Includes all relevant organizational, academic, family, and library data
 * 
 * Uses React cache() for request-level deduplication
 */
export const getStudentMasterContext = cache(async (studentId: string, organizationId: string) => {
    return getMasterContext({
        organizationId,
        studentId,
    });
});

/**
 * Fetches current objectives for a student based on their enrolled courses
 * Returns objectives from all strands the student is enrolled in
 * 
 * Uses React cache() for request-level deduplication
 */
export const getStudentObjectives = cache(async (courseIds: string[]): Promise<ObjectiveWithRelations[]> => {
    if (courseIds.length === 0) {
        return [];
    }

    const objectives = await db.objective.findMany({
        where: {
            subtopic: {
                topic: {
                    strand: {
                        courses: {
                            some: {
                                id: { in: courseIds },
                            },
                        },
                    },
                },
            },
        },
        select: objectiveSelect,
        take: 20,
        orderBy: { sortOrder: "asc" },
    });

    return objectives as unknown as ObjectiveWithRelations[];
});

/**
 * Fetches relevant books for a student based on their enrolled subjects and strands
 * Returns books that match the student's academic focus areas
 * 
 * Uses React cache() for request-level deduplication
 */
export const getRelevantBooks = cache(async (
    organizationId: string,
    subjectIds: string[],
    strandIds: string[]
): Promise<BookWithRelations[]> => {
    if (subjectIds.length === 0 && strandIds.length === 0) {
        return [];
    }

    const books = await withTenant(
        (tx) =>
            tx.book.findMany({
                where: {
                    organizationId,
                    OR: [
                        { subjectId: { in: subjectIds } },
                        { strandId: { in: strandIds } },
                    ],
                },
                select: bookSelect,
                take: 10,
                orderBy: { createdAt: "desc" },
            }),
        undefined,
        { organizationId, userId: null }
    );

    return books as unknown as BookWithRelations[];
});

/**
 * Fetches all student profile data in parallel
 * This is the main query function that orchestrates all student-related data fetching
 */
export async function getStudentProfileData(studentId: string, organizationId: string) {
    // First, fetch the student to get course enrollment data
    const student = await getStudentById(studentId, organizationId);

    if (!student) {
        return null;
    }

    // Extract IDs for parallel queries
    const courseIds = student.courseEnrollments.map((ce) => ce.courseId);
    const subjectIds = student.courseEnrollments.map((ce) => ce.course.subjectId);
    const strandIds = student.courseEnrollments
        .map((ce) => ce.course.strandId)
        .filter((id): id is string => id !== null);

    // Fetch all dependent data in parallel
    const [masterContext, currentObjectives, relevantBooks] = await Promise.all([
        getStudentMasterContext(studentId, organizationId),
        getStudentObjectives(courseIds),
        getRelevantBooks(organizationId, subjectIds, strandIds),
    ]);

    return {
        student,
        masterContext,
        currentObjectives,
        relevantBooks,
    };
}

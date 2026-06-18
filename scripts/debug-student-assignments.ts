
import { loadEnvConfig } from '@next/env';
const projectDir = process.cwd();
loadEnvConfig(projectDir);

import { db } from "../src/server/db";

async function main() {
    console.log("Starting debug query...");
    const studentId = "test-student-id"; // We might need a real ID, but Prisma usually fails query parsing before checking ID existence if it's a schema issue. 
    // Or if it executes, it returns empty. 
    // The error "column (not available) does not exist" suggests a SQL generation error or execution error on DB.

    // We need a valid student ID to trigger the query effectively if the error is runtime SQL.
    // Let's first fetch ANY student.
    const student = await db.learner.findFirst();
    if (!student) {
        console.log("No students found. Creating dummy...");
        // Not creating one to avoid side effects, just use a fake UUID.
        // If the error is schema-mismatch, even an empty result query might trigger it if columns are selected.
    }

    const targetId = student?.id || "00000000-0000-0000-0000-000000000000";
    console.log("Using Student ID:", targetId);

    try {
        const assignments = await db.resourceAssignment.findMany({
            where: { studentId: targetId },
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
                assessment: {
                    select: {
                        id: true,
                        title: true,
                    },
                },
            },
            take: 5,
        });
        console.log("Query successful. Assignments found:", assignments.length);
    } catch (e) {
        console.error("Query failed:", e);
    }
}

main();

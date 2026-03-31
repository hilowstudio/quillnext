"use server";

import { db } from "@/server/db";
import { Prisma } from "@/generated/client";
import { addDays, isSameDay, startOfDay } from "date-fns";
import { revalidateTag, unstable_cache } from "next/cache";

// Helper to check if a date is a school day
async function isSchoolDay(date: Date, classroomId: string, schoolDaysOfWeek: number[], holidays: any[]): Promise<boolean> {
    const dayOfWeek = date.getDay();
    // 0 = Sunday, 1 = Monday, etc.

    // Check if it's a valid day of the week
    if (!schoolDaysOfWeek.includes(dayOfWeek)) {
        return false;
    }

    // Check if it's a holiday
    for (const holiday of holidays) {
        // Assuming holidayDate is a Date object or string
        const holidayDate = new Date(holiday.holidayDate);
        if (isSameDay(date, holidayDate)) {
            return false;
        }
    }

    return true;
}

// Function to find the next N school days
async function getNextSchoolDays(
    startDate: Date,
    count: number,
    classroom: any
): Promise<Date[]> {
    const days: Date[] = [];
    let currentDate = startOfDay(startDate);
    // Field 'schoolDaysOfWeek' doesn't exist on Classroom yet, defaulting to M-F
    const schoolDaysOfWeek = [1, 2, 3, 4, 5];
    const holidays = classroom.holidays || [];

    while (days.length < count) {
        if (await isSchoolDay(currentDate, classroom.id, schoolDaysOfWeek, holidays)) {
            days.push(new Date(currentDate));
        }
        currentDate = addDays(currentDate, 1);

        // Safety break to prevent infinite loops if no school days defined
        if (days.length === 0 && currentDate.getFullYear() > startDate.getFullYear() + 1) {
            throw new Error("Could not find any school days in the next year. Check classroom settings.");
        }
    }
    return days;
}

export async function distributeCourse(
    courseId: string,
    studentId: string,
    startDateInput: Date | string
) {
    try {
        const startDate = new Date(startDateInput);
        if (isNaN(startDate.getTime())) {
            return { success: false, error: "Invalid start date" };
        }
        console.log(`Distributing course ${courseId} to student ${studentId} starting ${startDate.toISOString()}`);

        // 1. Fetch Course Structure
        const course = await db.course.findUnique({
            where: { id: courseId },
            include: {
                blocks: {
                    orderBy: { position: 'asc' },
                    where: {
                        kind: 'LESSON'
                    }
                }
            }
        }) as any;

        if (!course) return { success: false, error: "Course not found" };
        console.log(`Found course with ${course.blocks.length} blocks`);

        if (course.blocks.length === 0) return { success: false, error: "No lessons to schedule" };

        // 2. Fetch Student Classroom Settings
        const enrollment = await db.classroomStudent.findFirst({
            where: { studentId },
            include: {
                classroom: {
                    include: {
                        holidays: true
                    }
                }
            }
        });

        if (!enrollment) {
            console.error("Student not enrolled");
            return { success: false, error: "Student is not enrolled in a classroom. Please add them to a classroom first." };
        }
        console.log(`Found enrollment in classroom ${enrollment.classroom.id}`);

        // 3. Calculate Dates
        const scheduleDates = await getNextSchoolDays(
            startDate,
            course.blocks.length,
            enrollment.classroom
        );
        console.log(`Calculated ${scheduleDates.length} dates.`);

        // 4. Create Schedule Items
        const scheduleItems = (course.blocks as any[]).map((block, index) => ({
            organizationId: course.organizationId,
            studentId,
            courseBlockId: block.id,
            date: scheduleDates[index],
            sequenceOrder: index,
            status: 'PENDING'
        }));

        // Batch insert
        await (db as any).studentScheduleItem.createMany({
            data: scheduleItems as any
        });

        console.log(`Inserted ${scheduleItems.length} items.`);

        return {
            success: true,
            count: scheduleItems.length
        };
    } catch (e: any) {
        console.error("Error during distribution:", e);
        return { success: false, error: e.message || "An unexpected error occurred" };
    }
}

export async function getWeeklySchedule(
    organizationId: string,
    startDate: Date,
    endDate: Date
) {
    const getCached = unstable_cache(
        async () => {
            // 1. Get all students in the org
            const students = await db.student.findMany({
                where: { organizationId },
                select: { id: true, firstName: true, preferredName: true }
            });

            // 2. Fetch Schedule Items for range
            const scheduleItems = await (db as any).studentScheduleItem.findMany({
                where: {
                    organizationId,
                    date: {
                        gte: startDate,
                        lte: endDate
                    },
                    status: { not: 'SKIPPED' } // Example filter
                },
                include: {
                    courseBlock: {
                        select: { title: true, course: { select: { title: true } } }
                    },
                    activity: {
                        select: { title: true }
                    }
                }
            });

            // 3. Fetch Custom Events
            const customEvents = await (db as any).customEvent.findMany({
                where: {
                    organizationId,
                    date: {
                        gte: startDate,
                        lte: endDate
                    }
                }
            });

            return {
                students,
                items: scheduleItems,
                events: customEvents
            };
        },
        [`schedule-${organizationId}-${startDate.toISOString()}-${endDate.toISOString()}`],
        {
            tags: [`schedule-${organizationId}`],
            revalidate: 3600 // 1 hour
        }
    );

    return getCached();
}

export async function getStudentDailySchedule(
    studentId: string,
    date: Date
) {
    const start = startOfDay(date);
    // Daily schedule specific to the day requested.

    const items = await (db as any).studentScheduleItem.findMany({
        where: {
            studentId,
            date: {
                gte: start,
                lt: addDays(start, 1)
            }
        },
        include: {
            courseBlock: {
                select: { title: true, course: { select: { title: true } } }
            },
            activity: {
                select: { title: true }
            }
        },
        orderBy: { sequenceOrder: 'asc' }
    });

    const events = await (db as any).customEvent.findMany({
        where: {
            studentId, // or null/org wide? Schema says studentId is optional.
            date: {
                gte: start,
                lt: addDays(start, 1)
            }
        }
    });

    return { items, events };
}

export async function toggleItemStatus(
    itemId: string,
    status: 'PENDING' | 'COMPLETED' | 'SKIPPED'
) {
    const item = await (db as any).studentScheduleItem.update({
        where: { id: itemId },
        data: { status }
    });

    if (item?.organizationId) {
        revalidateTag(`schedule-${item.organizationId}`, {});
    }
    return { success: true };
}

export async function moveScheduleItem(itemId: string, newDate: Date) {
    try {
        const item = await (db as any).studentScheduleItem.update({
            where: { id: itemId },
            data: { date: newDate }
        });

        if (item?.organizationId) {
            revalidateTag(`schedule-${item.organizationId}`, {});
        }
        return { success: true };
    } catch (e: any) {
        console.error("Error moving item:", e);
        return { success: false, error: e.message };
    }
}

export async function addAdHocEvent(
    studentId: string,
    date: Date,
    title: string,
    description?: string,
    organizationId?: string,
) {
    try {
        if (!organizationId) {
            // Infer org from user? Or pass it.
            // For now, let's look up student's org
            const student = await db.student.findUnique({
                where: { id: studentId },
                select: { organizationId: true }
            });
            if (student) organizationId = student.organizationId;
        }

        if (!organizationId) throw new Error("Organization ID required");

        await (db as any).customEvent.create({
            data: {
                organizationId,
                studentId,
                date,
                title,
                description,
                isAllDay: true,
            }
        });

        revalidateTag(`schedule-${organizationId}`, {});
        return { success: true };
    } catch (e: any) {
        console.error("Failed to create ad-hoc event:", e);
        return { success: false, error: e.message };
    }
}

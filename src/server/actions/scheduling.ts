"use server";

import { withTenant } from "@/server/db";
import { addDays, isSameDay, startOfDay } from "date-fns";
import { revalidateTag, unstable_cache } from "next/cache";
import { getCurrentUserOrg } from "@/lib/auth-helpers";

// --- Authorization guards ---
// Every exported action must derive the org from the session (NEVER trust a
// caller-supplied organizationId) and verify the target student/course/item
// belongs to that org.

async function requireOrg() {
    const { organizationId } = await getCurrentUserOrg(); // throws if unauthenticated
    if (!organizationId) throw new Error("No organization found");
    return organizationId;
}

async function assertStudentInOrg(studentId: string, organizationId: string) {
    const s = await withTenant(
        (tx) => tx.student.findUnique({ where: { id: studentId }, select: { organizationId: true } }),
        undefined,
        { organizationId, userId: null }
    );
    if (!s || s.organizationId !== organizationId) throw new Error("Unauthorized");
}

// Helper to check if a date is a school day
async function isSchoolDay(date: Date, classroomId: string, schoolDaysOfWeek: number[], holidays: any[]): Promise<boolean> {
    const dayOfWeek = date.getDay();

    if (!schoolDaysOfWeek.includes(dayOfWeek)) {
        return false;
    }

    for (const holiday of holidays) {
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
    const schoolDaysOfWeek = [1, 2, 3, 4, 5];
    const holidays = classroom.holidays || [];

    while (days.length < count) {
        if (await isSchoolDay(currentDate, classroom.id, schoolDaysOfWeek, holidays)) {
            days.push(new Date(currentDate));
        }
        currentDate = addDays(currentDate, 1);

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
        const organizationId = await requireOrg();
        await assertStudentInOrg(studentId, organizationId);

        const startDate = new Date(startDateInput);
        if (isNaN(startDate.getTime())) {
            return { success: false, error: "Invalid start date" };
        }

        // 1. Fetch Course Structure (scoped to the caller's org)
        const course = await withTenant(
            (tx) => tx.course.findUnique({
                where: { id: courseId },
                include: {
                    blocks: {
                        orderBy: { position: 'asc' },
                        where: {
                            kind: 'LESSON'
                        }
                    }
                }
            }),
            undefined,
            { organizationId, userId: null }
        ) as any;

        if (!course || course.organizationId !== organizationId) return { success: false, error: "Course not found" };

        if (course.blocks.length === 0) return { success: false, error: "No lessons to schedule" };

        // 2. Fetch Student Classroom Settings
        const enrollment = await withTenant(
            (tx) => tx.classroomStudent.findFirst({
                where: { studentId },
                include: {
                    classroom: {
                        include: {
                            holidays: true
                        }
                    }
                }
            }),
            undefined,
            { organizationId, userId: null }
        );

        if (!enrollment) {
            return { success: false, error: "Student is not enrolled in a classroom. Please add them to a classroom first." };
        }

        // 3. Calculate Dates
        const scheduleDates = await getNextSchoolDays(
            startDate,
            course.blocks.length,
            enrollment.classroom
        );

        // 4. Create Schedule Items
        const scheduleItems = (course.blocks as any[]).map((block, index) => ({
            organizationId: course.organizationId,
            studentId,
            courseBlockId: block.id,
            date: scheduleDates[index],
            sequenceOrder: index,
            status: 'PENDING'
        }));

        await withTenant(
            (tx) => (tx as any).studentScheduleItem.createMany({
                data: scheduleItems as any
            }),
            undefined,
            { organizationId, userId: null }
        );

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
    _organizationId: string,
    startDate: Date,
    endDate: Date
) {
    // Ignore the caller-supplied org; always use the authenticated caller's org.
    const organizationId = await requireOrg();

    const getCached = unstable_cache(
        async () => {
            return withTenant(
                async (tx) => {
                    const students = await tx.student.findMany({
                        where: { organizationId },
                        select: { id: true, firstName: true, preferredName: true }
                    });

                    const scheduleItems = await (tx as any).studentScheduleItem.findMany({
                        where: {
                            organizationId,
                            date: {
                                gte: startDate,
                                lte: endDate
                            },
                            status: { not: 'SKIPPED' }
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

                    const customEvents = await (tx as any).customEvent.findMany({
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
                undefined,
                { organizationId, userId: null }
            );
        },
        [`schedule-${organizationId}-${startDate.toISOString()}-${endDate.toISOString()}`],
        {
            tags: [`schedule-${organizationId}`],
            revalidate: 3600
        }
    );

    return getCached();
}

export async function getStudentDailySchedule(
    studentId: string,
    date: Date
) {
    const organizationId = await requireOrg();
    await assertStudentInOrg(studentId, organizationId);

    const start = startOfDay(date);

    return withTenant(
        async (tx) => {
            const items = await (tx as any).studentScheduleItem.findMany({
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

            const events = await (tx as any).customEvent.findMany({
                where: {
                    studentId,
                    date: {
                        gte: start,
                        lt: addDays(start, 1)
                    }
                }
            });

            return { items, events };
        },
        undefined,
        { organizationId, userId: null }
    );
}

export async function toggleItemStatus(
    itemId: string,
    status: 'PENDING' | 'COMPLETED' | 'SKIPPED'
) {
    const organizationId = await requireOrg();
    const item = await withTenant(
        async (tx) => {
            const existing = await (tx as any).studentScheduleItem.findUnique({
                where: { id: itemId },
                select: { organizationId: true },
            });
            if (!existing || existing.organizationId !== organizationId) throw new Error("Unauthorized");

            return (tx as any).studentScheduleItem.update({
                where: { id: itemId },
                data: { status }
            });
        },
        undefined,
        { organizationId, userId: null }
    );

    if (item?.organizationId) {
        revalidateTag(`schedule-${item.organizationId}`, {});
    }
    return { success: true };
}

export async function moveScheduleItem(itemId: string, newDate: Date) {
    try {
        const organizationId = await requireOrg();
        const item = await withTenant(
            async (tx) => {
                const existing = await (tx as any).studentScheduleItem.findUnique({
                    where: { id: itemId },
                    select: { organizationId: true },
                });
                if (!existing || existing.organizationId !== organizationId) throw new Error("Unauthorized");

                return (tx as any).studentScheduleItem.update({
                    where: { id: itemId },
                    data: { date: newDate }
                });
            },
            undefined,
            { organizationId, userId: null }
        );

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
) {
    try {
        const organizationId = await requireOrg();
        await assertStudentInOrg(studentId, organizationId);

        await withTenant(
            (tx) => (tx as any).customEvent.create({
                data: {
                    organizationId,
                    studentId,
                    date,
                    title,
                    description,
                    isAllDay: true,
                }
            }),
            undefined,
            { organizationId, userId: null }
        );

        revalidateTag(`schedule-${organizationId}`, {});
        return { success: true };
    } catch (e: any) {
        console.error("Failed to create ad-hoc event:", e);
        return { success: false, error: e.message };
    }
}

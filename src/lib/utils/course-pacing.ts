import { db, withTenant } from "@/server/db";
import { getCurrentUserOrg } from "@/lib/auth-helpers";
import type { Schedule } from "@/lib/schemas/onboarding";

// -----------------------------------------------------------------------
// Course Pacing Calculation Utilities
// Calculates course dates based on family blueprint schedule
// -----------------------------------------------------------------------

export interface PacingConfig {
  totalWeeks: number;
  hoursPerWeek: number;
  schoolDaysOfWeek: number[];
  startDate: Date;
  endDate: Date;
  plannedOffDays?: Date[];
}

export interface CalculatedPacing {
  totalSchoolDays: number;
  availableDays: number;
  daysPerWeek: number;
  estimatedCompletionDate: Date;
  weeklySchedule: Array<{
    week: number;
    startDate: Date;
    endDate: Date;
    schoolDays: number;
  }>;
}

/**
 * Calculates course pacing based on classroom schedule
 * Used by both UI (for preview) and Server Actions (for saving)
 */
export async function calculateCoursePacing(
  classroomId: string,
  config: {
    totalWeeks: number;
    hoursPerWeek: number;
  },
): Promise<CalculatedPacing> {
  const { organizationId, userId } = await getCurrentUserOrg();
  const classroom = await withTenant(
    (tx) =>
      tx.classroom.findUnique({
        where: { id: classroomId },
        include: {
          holidays: true,
        },
      }),
    undefined,
    { organizationId, userId },
  );

  if (!classroom) {
    throw new Error(`Classroom ${classroomId} not found`);
  }

  const schoolDaysOfWeek = (classroom.schoolDaysOfWeek as number[]) || [];
  const startDate = classroom.schoolYearStartDate;
  const endDate = classroom.schoolYearEndDate;

  // Get planned holidays
  const plannedOffDays = classroom.holidays.map((h: { holidayDate: Date }) => h.holidayDate);

  return calculatePacingFromSchedule(
    {
      totalWeeks: config.totalWeeks,
      hoursPerWeek: config.hoursPerWeek,
      schoolDaysOfWeek,
      startDate,
      endDate,
      plannedOffDays,
    },
    classroom,
  );
}

/**
 * Calculates pacing from a schedule object (for preview/validation)
 */
export function calculatePacingFromSchedule(
  config: PacingConfig,
  classroom?: { holidays: Array<{ holidayDate: Date }> } | null,
): CalculatedPacing {
  const { totalWeeks, schoolDaysOfWeek, startDate, endDate, plannedOffDays = [] } = config;

  // Calculate total school days in the period
  const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  let schoolDays = 0;

  const weeklySchedule: CalculatedPacing["weeklySchedule"] = [];

  // Iterate through each week
  for (let week = 1; week <= totalWeeks; week++) {
    const weekStart = new Date(startDate);
    weekStart.setDate(weekStart.getDate() + (week - 1) * 7);

    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);

    // Count school days in this week (excluding holidays)
    let weekSchoolDays = 0;
    for (let day = 0; day < 7; day++) {
      const currentDate = new Date(weekStart);
      currentDate.setDate(currentDate.getDate() + day);

      const dayOfWeek = currentDate.getDay(); // 0 = Sunday, 1 = Monday, etc.

      // Check if it's a school day
      if (schoolDaysOfWeek.includes(dayOfWeek)) {
        // Check if it's not a planned holiday
        const isHoliday = plannedOffDays.some(
          (holiday) =>
            holiday.getDate() === currentDate.getDate() &&
            holiday.getMonth() === currentDate.getMonth() &&
            holiday.getFullYear() === currentDate.getFullYear(),
        );

        if (!isHoliday) {
          weekSchoolDays++;
          schoolDays++;
        }
      }
    }

    weeklySchedule.push({
      week,
      startDate: weekStart,
      endDate: weekEnd,
      schoolDays: weekSchoolDays,
    });
  }

  const daysPerWeek = schoolDays / totalWeeks;
  const estimatedCompletionDate = new Date(startDate);
  estimatedCompletionDate.setDate(estimatedCompletionDate.getDate() + totalWeeks * 7);

  return {
    totalSchoolDays: schoolDays,
    availableDays: schoolDays,
    daysPerWeek: Math.round(daysPerWeek * 10) / 10, // Round to 1 decimal
    estimatedCompletionDate,
    weeklySchedule,
  };
}

/**
 * Auto-fills course schedule based on objectives and available time
 * Uses sortOrder from sequenced standards to maintain proper order
 */
export async function autoFillCourseSchedule(
  subjectId: string,
  gradeLevel: number,
  availableWeeks: number,
): Promise<Array<{ objectiveId: string; week: number; order: number }>> {
  // Fetch objectives for this subject/grade, sorted by sortOrder
  const objectives = await db.objective.findMany({
    where: {
      subtopic: {
        topic: {
          strand: {
            subjectId,
          },
        },
      },
      gradeLevel,
    },
    orderBy: {
      sortOrder: "asc",
    },
    take: 100, // Limit for performance
  });

  // Distribute objectives across weeks
  const objectivesPerWeek = Math.ceil(objectives.length / availableWeeks);
  const schedule: Array<{ objectiveId: string; week: number; order: number }> = [];

  objectives.forEach((objective: { id: string }, index: number) => {
    const week = Math.floor(index / objectivesPerWeek) + 1;
    const order = (index % objectivesPerWeek) + 1;

    schedule.push({
      objectiveId: objective.id,
      week: Math.min(week, availableWeeks), // Cap at available weeks
      order,
    });
  });

  return schedule;
}


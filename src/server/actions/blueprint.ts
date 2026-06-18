"use server";

import { withTenant } from "@/server/db";
import { setRlsContext } from "@/server/rls-context";
import {
  classroomStepSchema,
  scheduleStepSchema,
  environmentStepSchema,
  type Classroom,
  type Schedule,
  type Environment,
} from "@/lib/schemas/onboarding";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { getCurrentUserOrg } from "@/lib/auth-helpers";
import { parentProfileId } from "@/server/profiles/ids";

// -----------------------------------------------------------------------
// Family Blueprint Server Actions
// Progressive saving - each step saves independently
// -----------------------------------------------------------------------

/**
 * Save Classroom step (Step 1)
 * Creates/updates classroom and instructors
 */
export async function saveClassroomStep(
  organizationId: string | null,
  userId: string,
  data: z.infer<typeof classroomStepSchema>,
) {
  // Derive identity from the session — never trust caller-supplied org/userId.
  const caller = await getCurrentUserOrg();
  organizationId = caller.organizationId;
  userId = caller.userId;

  const validated = classroomStepSchema.parse(data);

  // Hash the instructor PIN
  const pinHash = await bcrypt.hash(validated.instructorPin, 10);

  // Use transaction to ensure consistency
  const result = await withTenant(async (tx) => {
    let activeOrgId = organizationId;

    // If no organization exists, create one
    if (!activeOrgId) {
      const lastName = validated.instructors[0]?.lastName || "Family";
      const orgName = `${lastName} Family`;

      const newOrg = await tx.organization.create({
        data: {
          name: orgName,
          type: "PARENT_INSTRUCTOR",
        },
      });
      activeOrgId = newOrg.id;

      // Link user to new organization
      await tx.user.update({
        where: { id: userId },
        data: { organizationId: activeOrgId },
      });
    }

    // RLS: re-stamp the tenant GUC to the (possibly just-created) org so the classroom +
    // instructor inserts below satisfy their WITH CHECK. The organization INSERT above runs
    // under the request's null context, which the relaxed organizations INSERT policy permits
    // during first-run onboarding.
    await tx.$executeRaw`SELECT set_config('app.current_org', ${activeOrgId}, true)`;
    setRlsContext({ organizationId: activeOrgId, userId });

    // Find existing classroom or create new one
    let classroom = await tx.classroom.findFirst({
      where: { organizationId: activeOrgId },
      orderBy: { createdAt: "desc" },
    });

    if (classroom) {
      // Update existing classroom
      classroom = await tx.classroom.update({
        where: { id: classroom.id },
        data: {
          name: validated.name,
          description: validated.description,
          educationalPhilosophy: validated.educationalPhilosophy,
          educationalPhilosophyOther: validated.educationalPhilosophyOther,
          faithBackground: validated.faithBackground,
          faithBackgroundOther: validated.faithBackgroundOther,
          academicGoals: validated.academicGoals || [],
        },
      });
    } else {
      // Create new classroom
      classroom = await tx.classroom.create({
        data: {
          organizationId: activeOrgId,
          createdByUserId: userId,
          name: validated.name,
          description: validated.description,
          educationalPhilosophy: validated.educationalPhilosophy,
          educationalPhilosophyOther: validated.educationalPhilosophyOther,
          faithBackground: validated.faithBackground,
          faithBackgroundOther: validated.faithBackgroundOther,
          academicGoals: validated.academicGoals || [],
          // Default schedule dates (will be updated in schedule step)
          schoolYearStartDate: new Date(),
          schoolYearEndDate: new Date(),
          schoolDaysOfWeek: [1, 2, 3, 4, 5], // Default Mon-Fri
        },
      });
    }

    // Update instructors
    // First, delete existing instructors for this classroom
    await tx.classroomInstructor.deleteMany({
      where: { classroomId: classroom.id },
    });

    // Create new instructors
    const instructors = await Promise.all(
      validated.instructors.map((instructor, index) =>
        tx.classroomInstructor.create({
          data: {
            classroomId: classroom.id,
            userId: index === 0 ? userId : userId, // First instructor is the user
            firstName: instructor.firstName,
            lastName: instructor.lastName,
            sex: instructor.sex,
            email: instructor.email || "",
            instructorPin: pinHash,
            role: index === 0 ? "PRIMARY" : "ASSISTANT",
          },
        }),
      ),
    );

    // Update user's name from first instructor
    if (validated.instructors[0]) {
      await tx.user.update({
        where: { id: userId },
        data: {
          name: `${validated.instructors[0].firstName} ${validated.instructors[0].lastName || ""}`.trim(),
        },
      });
    }

    // Ensure the account owner's PARENT profile exists (idempotent; same id as the backfill).
    // pinHash is set on CREATE only (mirrors the classroom PIN so the owner card is PIN-protected);
    // we deliberately do NOT re-stamp it on update, so re-running onboarding can't clobber a PIN
    // managed elsewhere later (Slice 5 owns per-profile PIN management).
    const ownerName = validated.instructors[0]
      ? `${validated.instructors[0].firstName} ${validated.instructors[0].lastName || ""}`.trim()
      : "Parent";
    await tx.profile.upsert({
      where: { id: parentProfileId(userId) },
      create: {
        id: parentProfileId(userId),
        organizationId: activeOrgId,
        type: "PARENT",
        displayName: ownerName,
        pinHash,
        userId,
        isOwner: true,
      },
      update: { displayName: ownerName },
    });

    return { classroom, instructors, organizationId: activeOrgId };
  }, undefined, { organizationId, userId });

  revalidatePath("/onboarding");
  return { success: true, data: result };
}

/**
 * Save Schedule step (Step 2)
 * Updates classroom schedule
 */
export async function saveScheduleStep(
  organizationId: string,
  data: z.infer<typeof scheduleStepSchema>,
) {
  const { organizationId: sessionOrg } = await getCurrentUserOrg();
  if (!sessionOrg) throw new Error("Classroom not found. Please complete Step 1 first.");
  organizationId = sessionOrg;

  const validated = scheduleStepSchema.parse(data);

  // Parse times if provided
  let dailyStartTime: Date | null = null;
  let dailyEndTime: Date | null = null;

  if (validated.dailyStartTime && !validated.dailyTimesVary) {
    const [hours, minutes] = validated.dailyStartTime.split(":").map(Number);
    dailyStartTime = new Date();
    dailyStartTime.setHours(hours, minutes, 0, 0);
  }

  if (validated.dailyEndTime && !validated.dailyTimesVary) {
    const [hours, minutes] = validated.dailyEndTime.split(":").map(Number);
    dailyEndTime = new Date();
    dailyEndTime.setHours(hours, minutes, 0, 0);
  }

  // RLS: org-scoped reads/writes (classroom, classroomHoliday) share one tenant-stamped tx.
  const updated = await withTenant(
    async (tx) => {
      // Find the classroom for this organization
      const classroom = await tx.classroom.findFirst({
        where: { organizationId },
        orderBy: { createdAt: "desc" },
      });

      if (!classroom) {
        throw new Error("Classroom not found. Please complete Step 1 first.");
      }

      // Update classroom schedule
      const updated = await tx.classroom.update({
        where: { id: classroom.id },
        data: {
          schoolYearStartDate: validated.schoolYearStartDate,
          schoolYearEndDate: validated.schoolYearEndDate,
          schoolDaysOfWeek: validated.schoolDaysOfWeek,
          dailyStartTime: dailyStartTime,
          dailyEndTime: dailyEndTime,
        },
      });

      // Handle breaks (store in a separate table or JSON field)
      // For now, we'll skip breaks as they may need a separate model

      // Handle planned off days
      if (validated.plannedOffDays && validated.plannedOffDays.length > 0) {
        // Delete existing holidays
        await tx.classroomHoliday.deleteMany({
          where: { classroomId: classroom.id },
        });

        // Create new holidays
        await Promise.all(
          validated.plannedOffDays.map((date) =>
            tx.classroomHoliday.create({
              data: {
                classroomId: classroom.id,
                holidayDate: date,
                name: "Planned Day Off",
                isAllDay: true,
              },
            }),
          ),
        );
      }

      return updated;
    },
    undefined,
    { organizationId, userId: null },
  );

  revalidatePath("/onboarding");
  return { success: true, data: updated };
}

/**
 * Save Environment step (Step 3)
 * Stores environment preferences in a JSON field
 * Note: Requires adding `environmentPreferences Json?` field to Classroom model
 * For now, we'll use a workaround by storing in description or create a separate table
 */
export async function saveEnvironmentStep(
  organizationId: string,
  data: z.infer<typeof environmentStepSchema>,
) {
  const { organizationId: sessionOrg } = await getCurrentUserOrg();
  if (!sessionOrg) throw new Error("Classroom not found. Please complete Step 1 first.");
  organizationId = sessionOrg;

  const validated = environmentStepSchema.parse(data);

  // Store environment data in the proper JSON field
  const environmentData = {
    philosophyPreferences: validated.philosophyPreferences || [],
    resourceTypes: validated.resourceTypes || [],
    goals: validated.goals || [],
    deviceTypes: validated.deviceTypes || [],
    challenges: validated.challenges || [],
    faithBackground: validated.faithBackground || null,
  };

  // RLS: org-scoped classroom read + update share one tenant-stamped tx.
  await withTenant(
    async (tx) => {
      const classroom = await tx.classroom.findFirst({
        where: { organizationId },
        orderBy: { createdAt: "desc" },
      });

      if (!classroom) {
        throw new Error("Classroom not found. Please complete Step 1 first.");
      }

      // Update classroom with environment preferences
      await tx.classroom.update({
        where: { id: classroom.id },
        data: {
          environmentPreferences: environmentData,
        },
      });
    },
    undefined,
    { organizationId, userId: null },
  );

  revalidatePath("/onboarding");
  revalidatePath("/blueprint");
  return { success: true, message: "Environment preferences saved" };
}

/**
 * Get current blueprint progress
 * Used to restore wizard state
 */
export async function getBlueprintProgress(organizationId: string | null) {
  // Use the caller's own org, not whatever was passed in.
  const { organizationId: sessionOrg } = await getCurrentUserOrg();
  organizationId = sessionOrg;
  if (!organizationId) {
    return { step: 1, data: null };
  }

  const classroom = await withTenant(
    (tx) =>
      tx.classroom.findFirst({
        where: { organizationId },
        include: {
          instructors: true,
          holidays: true,
        },
        orderBy: { createdAt: "desc" },
      }),
    undefined,
    { organizationId, userId: null },
  );

  if (!classroom) {
    return { step: 1, data: null };
  }

  // Determine which step is complete
  const hasSchedule =
    classroom.schoolYearStartDate && classroom.schoolYearEndDate;

  // If schedule is done, we are effectively done with the wizard (Step 3 removed)
  return {
    step: hasSchedule ? 3 : 2, // 3 means "Done" in this context since we only have 2 steps
    data: classroom,
  };
}


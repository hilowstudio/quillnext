import { z } from "zod";
import { pinSchema } from "@/lib/schemas/pin";

// -----------------------------------------------------------------------
// Family Blueprint Wizard Schemas
// -----------------------------------------------------------------------

export const instructorSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().optional(),
  sex: z.enum(["MALE", "FEMALE", "OTHER", "PREFER_NOT_TO_SAY"]).optional(),
  whatStudentsCall: z.string().optional(), // e.g., "Mom", "Dad", "Ms. Smith"
  email: z.string().email().optional(),
});

export const classroomSchema = z.object({
  name: z.string().min(1, "Classroom name is required"),
  description: z.string().optional(),
  instructors: z.array(instructorSchema).min(1, "At least one instructor is required"),
  // Optional: blank means "keep the existing owner PIN" (set at first onboarding). See FEAT-22.
  instructorPin: pinSchema.optional().or(z.literal("")),
  educationalPhilosophy: z.enum([
    "TRADITIONAL_SCHOOL_AT_HOME",
    "VIRTUAL_ONLINE",
    "CLASSICAL",
    "CHARLOTTE_MASON",
    "UNIT_STUDIES",
    "MONTESSORI",
    "UNSCHOOLING",
    "WALDORF",
    "ECLECTIC",
    "THOMAS_JEFFERSON_EDUCATION",
    "ROADSCHOOLING",
    "WORLDSCHOOLING",
    "GAMESCHOOLING",
    "REGGIO_EMILIA",
    "WILD_AND_FREE",
    "PROJECT_BASED_LEARNING",
    "OTHER",
  ]),
  educationalPhilosophyOther: z.string().optional(),
  academicGoals: z.array(z.string()).max(3, "Please select up to 3 goals").optional(),
  faithBackground: z.enum([
    "ROMAN_CATHOLIC",
    "EASTERN_CATHOLIC",
    "EASTERN_ORTHODOX",
    "GREEK_ORTHODOX",
    "RUSSIAN_ORTHODOX",
    "OTHER_ORTHODOX",
    "PROTESTANT",
    "ADVENTIST",
    "ANABAPTIST",
    "ANGLICAN_EPISCOPAL",
    "BAPTIST",
    "CHURCH_OF_CHRIST",
    "LUTHERAN",
    "METHODIST_WESLEYAN",
    "NONDENOMINATIONAL",
    "PENTECOSTAL_CHARISMATIC",
    "PRESBYTERIAN_REFORMED",
    "OTHER_PROTESTANT",
    "OTHER",
  ]),
  faithBackgroundOther: z.string().optional(),
});

export const scheduleSchema = z.object({
  schoolYearStartDate: z.date(),
  schoolYearEndDate: z.date(),
  isYearRound: z.boolean().optional(),

  // Logic: Either schoolDaysOfWeek OR daysPerWeek must be present depending on UI state
  schoolDaysOfWeek: z.array(z.number().int().min(0).max(6)).optional(),
  daysPerWeek: z.number().int().min(1).max(7).optional(),

  dailyTimesVary: z.boolean().optional(),
  dailyStartTime: z.string().optional(),
  dailyEndTime: z.string().optional(),
  hoursPerDay: z.number().int().min(1).max(24).optional(),
  breaks: z
    .array(
      z.object({
        type: z.enum(["BREAKFAST", "LUNCH", "DINNER", "SNACK", "RECESS", "EXERCISE", "SPORTS"]),
        startTime: z.string().regex(/^\d{2}:\d{2}$/),
        endTime: z.string().regex(/^\d{2}:\d{2}$/),
        durationMinutes: z.number().int().positive().optional(),
      }),
    )
    .optional(),
  plannedOffDays: z.array(z.date()).optional(), // Calendar selection
});

export const environmentSchema = z.object({
  philosophyPreferences: z.array(z.string()).optional(),
  resourceTypes: z.array(z.string()).optional(),
  goals: z.array(z.string()).optional(),
  deviceTypes: z.array(z.string()).optional(),
  challenges: z.array(z.string()).optional(),
  faithBackground: z.string().optional(), // Additional context
});

// Combined Family Blueprint Schema
export const familyBlueprintSchema = z.object({
  // Step 1: Classroom
  classroom: classroomSchema,
  // Step 2: Schedule
  schedule: scheduleSchema,
  // Step 3: Environment (optional final step of the 3-step wizard)
  environment: environmentSchema.optional(),
});

export type Instructor = z.infer<typeof instructorSchema>;
export type Classroom = z.infer<typeof classroomSchema>;
export type Schedule = z.infer<typeof scheduleSchema>;
export type Environment = z.infer<typeof environmentSchema>;

// Progressive save schemas (for step-by-step saving)
export const classroomStepSchema = classroomSchema;
export const scheduleStepSchema = scheduleSchema;
export const environmentStepSchema = environmentSchema;


import { z } from "zod";

/**
 * Comprehensive Zod validation schemas for all Server Actions
 * Created as part of Phase 7+ refactoring
 */

// ============================================================================
// Course Actions
// ============================================================================

export const createCourseSchema = z.object({
    title: z.string().min(1, "Title is required").max(200),
    description: z.string().optional(),
    subjectId: z.string().uuid("Invalid subject ID"),
    strandId: z.string().uuid().optional().nullable(),
    gradeLevel: z.string().optional(),
});

export const updateCourseSchema = z.object({
    id: z.string().uuid("Invalid course ID"),
    title: z.string().min(1).max(200).optional(),
    description: z.string().optional(),
    subjectId: z.string().uuid().optional(),
    strandId: z.string().uuid().optional().nullable(),
    gradeLevel: z.string().optional(),
});

export const deleteCourseSchema = z.object({
    id: z.string().uuid("Invalid course ID"),
});

export const distributeCourseSchema = z.object({
    courseId: z.string().uuid("Invalid course ID"),
    studentId: z.string().uuid("Invalid student ID"),
    startDate: z.string().or(z.date()).optional(),
});

// ============================================================================
// Course Block Actions
// ============================================================================

export const createBlockSchema = z.object({
    courseId: z.string().uuid("Invalid course ID"),
    title: z.string().min(1).max(200),
    kind: z.string(),
    description: z.string().max(1000).optional(),
    parentBlockId: z.string().uuid().nullable().optional(),
    position: z.number().int().min(0).optional(),
});

export const updateBlockSchema = z.object({
    id: z.string().uuid("Invalid block ID"),
    courseId: z.string().uuid("Invalid course ID"),
    title: z.string().min(1).max(200).optional(),
    kind: z.string().optional(),
    description: z.string().max(1000).optional(),
});

export const deleteBlockSchema = z.object({
    id: z.string().uuid("Invalid block ID"),
    courseId: z.string().uuid("Invalid course ID"),
});

export const reorderBlocksSchema = z.object({
    courseId: z.string().uuid("Invalid course ID"),
    updates: z.array(
        z.object({
            id: z.string().uuid(),
            position: z.number().int().min(0),
            parentBlockId: z.string().uuid().nullable().optional(),
        })
    ),
});

// ============================================================================
// Student Actions
// ============================================================================

export const createStudentSchema = z.object({
    firstName: z.string().min(1, "First name is required").max(100),
    lastName: z.string().min(1, "Last name is required").max(100),
    preferredName: z.string().max(100).optional(),
    gradeLevel: z.string().optional(),
    birthDate: z.string().or(z.date()).optional(),
    sex: z.enum(["MALE", "FEMALE"]).optional(),
    avatarConfig: z.any().optional(),
});

export const updateStudentSchema = z.object({
    id: z.string().uuid("Invalid student ID"),
    firstName: z.string().min(1).max(100).optional(),
    lastName: z.string().min(1).max(100).optional(),
    preferredName: z.string().max(100).optional(),
    gradeLevel: z.string().optional(),
    birthDate: z.string().or(z.date()).optional(),
    sex: z.enum(["MALE", "FEMALE"]).optional(),
    avatarConfig: z.any().optional(),
});

export const deleteStudentSchema = z.object({
    id: z.string().uuid("Invalid student ID"),
});

// ============================================================================
// Resource Generation
// ============================================================================

export const generateResourceSchema = z.object({
    sourceId: z.string().min(1),
    sourceType: z.enum([
        "BOOK", "VIDEO", "COURSE", "TOPIC", "URL", "FILE", "YOUTUBE_PLAYLIST",
        // Spine-driven generation at ANY academic-spine level (sourceId = the node id).
        "SUBJECT", "STRAND", "TOPIC_NODE", "SUBTOPIC", "OBJECTIVE",
    ]),
    resourceKindId: z.string().uuid("Invalid resource kind ID"),
    instructions: z.string().max(8000).optional(),
    additionalData: z.object({
        topicText: z.string().max(2000).optional(),
        // NOT .url(): the URL field has no client validation and the core embeds it
        // verbatim into the prompt (it even tolerates scheme-less domains / topic phrases,
        // generate-resource-core.ts:626-631), so a strict URL check would reject valid input.
        url: z.string().max(2000).optional(),
        fileContent: z.string().max(200000).optional(),
        fileName: z.string().max(500).optional(),
        studentId: z.string().uuid().optional(),
        // Phase-2 book-chapter scoping + OBJECTIVE textbook-grounding subject override
        // (match GenerateResourceCoreParams.additionalData in generate-resource-core.ts:221-233).
        sectionNumber: z.number().int().optional(),
        subject: z.string().max(200).optional(),
    }).optional(),
});

// ============================================================================
// Assignment Actions
// ============================================================================

export const createAssignmentSchema = z.object({
    resourceId: z.string().uuid("Invalid resource ID"),
    studentId: z.string().uuid("Invalid student ID"),
    courseId: z.string().uuid().optional(),
    dueDate: z.string().or(z.date()).optional(),
    notes: z.string().max(1000).optional(),
});

export const updateAssignmentSchema = z.object({
    id: z.string().uuid("Invalid assignment ID"),
    status: z.enum(["PENDING", "IN_PROGRESS", "COMPLETED", "SKIPPED"]).optional(),
    completedAt: z.string().or(z.date()).optional(),
    notes: z.string().max(1000).optional(),
});

export const deleteAssignmentSchema = z.object({
    id: z.string().uuid("Invalid assignment ID"),
});

// ============================================================================
// User Actions  
// ============================================================================

export const updateUserProfileSchema = z.object({
    firstName: z.string().min(1).max(100).optional(),
    lastName: z.string().min(1).max(100).optional(),
    email: z.string().email("Invalid email").optional(),
});

//============================================================================
// Grading Actions
// ============================================================================

export const submitGradeSchema = z.object({
    assignmentId: z.string().uuid("Invalid assignment ID"),
    studentId: z.string().uuid("Invalid student ID"),
    score: z.number().min(0).max(100, "Score must be between 0 and 100"),
    feedback: z.string().max(2000).optional(),
});

// ============================================================================
// YouTube/Video Actions
// ============================================================================

export const fetchPlaylistSchema = z.object({
    url: z.string().url("Invalid playlist URL"),
});

export const fetchVideoSchema = z.object({
    videoId: z.string().min(1, "Video ID is required"),
});

// ============================================================================
// Library Actions
// ============================================================================

export const searchLibrarySchema = z.object({
    query: z.string().min(1).max(200),
    type: z.enum(["BOOK", "VIDEO", "RESOURCE"]).optional(),
    subjectId: z.string().uuid().optional(),
});

// ============================================================================
// Bible Study / Discipleship Actions
// ============================================================================

export const createBibleStudySchema = z.object({
    studentId: z.string().uuid("Invalid student ID"),
    passage: z.string().min(1).max(500),
    notes: z.string().max(5000).optional(),
});

export const createHeartCheckSchema = z.object({
    studentId: z.string().uuid("Invalid student ID"),
    responses: z.record(z.string(), z.any()),
    date: z.string().or(z.date()).optional(),
});

export const createPrayerJournalSchema = z.object({
    studentId: z.string().uuid("Invalid student ID").optional().nullable(),
    title: z.string().min(1).max(200),
    content: z.string().max(10000),
    prayerType: z.enum(["PRAISE", "CONFESSION", "THANKSGIVING", "SUPPLICATION"]).optional(),
});

// ============================================================================
// Scheduling Actions
// ============================================================================

export const createScheduleItemSchema = z.object({
    title: z.string().min(1).max(200),
    description: z.string().max(1000).optional(),
    startDate: z.string().or(z.date()),
    endDate: z.string().or(z.date()).optional(),
    studentIds: z.array(z.string().uuid()).optional(),
});

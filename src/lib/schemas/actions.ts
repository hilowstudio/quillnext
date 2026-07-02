import { z } from "zod";
import { courseBlockKindSchema } from "./courses";

/**
 * Comprehensive Zod validation schemas for all Server Actions
 * Created as part of Phase 7+ refactoring
 */

// ============================================================================
// Course Actions
// ============================================================================

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

export const updateBlockSchema = z.object({
    id: z.string().uuid("Invalid block ID"),
    courseId: z.string().uuid("Invalid course ID"),
    title: z.string().min(1).max(200).optional(),
    kind: courseBlockKindSchema.optional(),
    description: z.string().max(1000).optional(),
});

export const deleteBlockSchema = z.object({
    id: z.string().uuid("Invalid block ID"),
    courseId: z.string().uuid("Invalid course ID"),
});

// ============================================================================
// Student Actions
// ============================================================================

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
// YouTube/Video Actions
// ============================================================================

export const fetchPlaylistSchema = z.object({
    url: z.string().url("Invalid playlist URL"),
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

export const createPrayerJournalSchema = z.object({
    studentId: z.string().uuid("Invalid student ID").optional().nullable(),
    title: z.string().min(1).max(200),
    content: z.string().max(10000),
    prayerType: z.enum(["PRAISE", "CONFESSION", "THANKSGIVING", "SUPPLICATION"]).optional(),
});

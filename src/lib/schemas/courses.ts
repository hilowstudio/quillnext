import { z } from "zod";

// -----------------------------------------------------------------------
// Course Block Schemas
// -----------------------------------------------------------------------

export const courseBlockKindSchema = z.enum(["UNIT", "MODULE", "SECTION", "CHAPTER", "LESSON"]);
export type CourseBlockKind = z.infer<typeof courseBlockKindSchema>;

export const courseBlockSchema = z.object({
  kind: courseBlockKindSchema,
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  position: z.number().int().positive(),
  parentBlockId: z.string().optional(),
  topicId: z.string().optional(),
  subtopicId: z.string().optional(),
  bookId: z.string().optional(),
  bookChapterId: z.string().optional(),
});

export type CourseBlockFormData = z.infer<typeof courseBlockSchema>;

// -----------------------------------------------------------------------
// Block kind-nesting rules
// -----------------------------------------------------------------------

/**
 * Legal parent block kinds for each block kind, mirroring the client-side
 * `getAvailableParentBlocks` rules (courses/[id]/blocks/new/page.tsx). A UNIT may
 * only sit at the top level (no legal parent); a LESSON may nest under anything.
 */
export const BLOCK_KIND_ALLOWED_PARENTS: Record<CourseBlockKind, CourseBlockKind[]> = {
  UNIT: [],
  MODULE: ["UNIT"],
  SECTION: ["UNIT", "MODULE"],
  CHAPTER: ["UNIT", "MODULE", "SECTION"],
  LESSON: ["UNIT", "MODULE", "SECTION", "CHAPTER", "LESSON"],
};

/**
 * Validates that a block of `childKind` may legally nest under a parent of
 * `parentKind` (or have no parent when `parentKind` is null — top-level placement
 * is always allowed). Enforced server-side by the block create/update API routes
 * so the kind-nesting hierarchy is not browser-only.
 */
export function validateBlockNesting(
  childKind: CourseBlockKind,
  parentKind: CourseBlockKind | null,
): { ok: true } | { ok: false; error: string } {
  if (parentKind === null) return { ok: true };
  if (!BLOCK_KIND_ALLOWED_PARENTS[childKind].includes(parentKind)) {
    return {
      ok: false,
      error: `A ${childKind} block cannot be nested under a ${parentKind} block.`,
    };
  }
  return { ok: true };
}

// -----------------------------------------------------------------------
// Course create (REST API) schema
// -----------------------------------------------------------------------

/**
 * Validates the body of `POST /api/courses`. Distinct from `createCourseSchema`
 * in `lib/schemas/actions.ts` (that one is for the server-action path and requires
 * UUID ids + a `gradeLevel`): this route accepts a `subjectId`/`strandId` that may be
 * a real id OR a `new:<name>` token the handler mints into a Subject/Strand, so the
 * ids are bounded plain strings (NOT `.uuid()`). The bound also caps the minted
 * taxonomy name length. `title` is trimmed so a whitespace-only title is rejected
 * (the client only disables submit on `title.trim()`, but the API gets raw input).
 */
export const createCourseApiSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200),
  description: z.string().max(2000).optional().nullable(),
  subjectId: z.string().min(1, "Subject ID required").max(255),
  strandId: z.string().min(1).max(255).optional().nullable(),
  gradeBandId: z.string().min(1).max(255).optional().nullable(),
});


// -----------------------------------------------------------------------
// Activity create (REST API) schema
// -----------------------------------------------------------------------

/** The Prisma `ActivityType` enum values (schema.prisma) — kept in sync here. */
export const activityTypeSchema = z.enum([
  "READING",
  "WRITING",
  "DISCUSSION",
  "PROJECT",
  "LAB",
  "WORKSHEET",
  "OTHER",
]);

/**
 * Validates the body of `POST /api/courses/[id]/blocks/[blockId]/activities`.
 * Mirrors the client form (`activities/new/page.tsx`): `title` trimmed/bounded,
 * `activityType` constrained to the Prisma ActivityType enum, `objectiveId`
 * optional (the client drops `new:` custom objectives, sending undefined, so the
 * route LINKS an existing global Objective — it never mints one). `estimatedMinutes`
 * is coerced (the JSON body may carry a number or numeric string) and must be a
 * positive integer if present. `position` is NOT accepted from the client — the
 * route assigns the next position within the block.
 */
export const createActivityApiSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200),
  description: z.string().max(2000).optional().nullable(),
  activityType: activityTypeSchema,
  objectiveId: z.string().min(1).max(255).optional().nullable(),
  estimatedMinutes: z.coerce.number().int().positive().max(100000).optional().nullable(),
});



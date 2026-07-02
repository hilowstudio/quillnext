import { z } from "zod";

// -----------------------------------------------------------------------
// Grading (REST API) schema
// -----------------------------------------------------------------------

/** The Prisma `GradingMethod` enum values (schema.prisma:1343-1346) — kept in sync here. */
export const gradingMethodSchema = z.enum(["AUTO", "AI_ASSISTED", "MANUAL"]);

/**
 * Validates the body of `POST /api/grading/[id]` (persist a graded attempt).
 *
 * The route does NOT trust the client's grade arithmetic (Q-18-001): `scorePoints`
 * and `maxPoints` are intentionally OMITTED here — the handler recomputes them
 * server-side from the assessment's item points and the (clamped) per-item scores,
 * so a forged or buggy client cannot persist a total that disagrees with the items,
 * and no per-item score can exceed its item's points. Any `scorePoints`/`maxPoints`
 * the client sends are silently stripped by Zod (object strip mode). This schema only
 * bounds what the client legitimately supplies:
 *   - `itemScores`    itemId → a finite, non-negative number (the handler then clamps
 *                     each to its item's max points and ignores unknown itemIds).
 *   - `itemFeedback`  itemId → a bounded feedback string.
 *   - `feedback`      the overall feedback string (bounded).
 *   - `gradingMethod` constrained to the Prisma GradingMethod enum (the client sends
 *                     "AI_ASSISTED" when any Inkling feedback was generated this session,
 *                     else "MANUAL" — Q-18-004); the handler defaults to "AI_ASSISTED"
 *                     if omitted.
 */
export const gradeAttemptApiSchema = z.object({
  feedback: z.string().max(10000).optional().nullable(),
  itemScores: z.record(z.string(), z.coerce.number().finite().nonnegative()).optional(),
  itemFeedback: z.record(z.string(), z.string().max(10000)).optional(),
  gradingMethod: gradingMethodSchema.optional(),
});


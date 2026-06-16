import { z } from "zod";

/**
 * Shared validation for a curriculum-compile request. Imported by BOTH the client form
 * (`SpecForm`) and the server action (`compileCurriculumAction`) so the server never trusts
 * the bypassable client-side schema. `durationDays` is hard-bounded (1–20) because it drives
 * `explode-bundle`'s per-day block creation — an unbounded value is a self-DoS / data-bloat vector.
 */
export const curriculumSpecSchema = z.object({
  subject: z.string().min(2, { message: "Subject is required." }),
  topic: z.string().min(5, { message: "Detailed topic is required." }),
  readingLevel: z.string().min(1, { message: "Reading level is required." }),
  durationDays: z.coerce.number().int().min(1).max(20),
  constraints: z.object({
    noDevices: z.boolean(),
    lowPrep: z.boolean(),
    groupWork: z.boolean(),
    visualAid: z.boolean(),
  }),
});

export type CurriculumSpecInput = z.infer<typeof curriculumSpecSchema>;

/** Defensive clamp for any code path that reads a persisted durationDays. */
export const MAX_DURATION_DAYS = 20;
export function clampDurationDays(n: number): number {
  return Math.min(Math.max(1, Math.floor(n) || 1), MAX_DURATION_DAYS);
}

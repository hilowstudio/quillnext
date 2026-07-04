// Grade bands — the tailoring axis for AI generation (the Generation Target's "how hard" knob).
// Per-grade was rejected as too heavy; 5 bands keep the copy matrix (Phase 2/3 block library) tractable.
// Plain constants only (NO Prisma import) so this stays client-bundle-safe — it's imported by the
// client Creation Station UI AND by server prompt assembly.

export const GRADE_BANDS = [
  { id: "EARLY_ELEMENTARY", label: "Early Elementary (K–2)" },
  { id: "UPPER_ELEMENTARY", label: "Upper Elementary (3–5)" },
  { id: "MIDDLE", label: "Middle School (6–8)" },
  { id: "HIGH", label: "High School (9–12)" },
  { id: "ADULT", label: "Adult / General" },
] as const;

export type GradeBandId = (typeof GRADE_BANDS)[number]["id"];

// Non-empty tuple form for `z.enum(...)`.
export const GRADE_BAND_IDS = GRADE_BANDS.map((b) => b.id) as [GradeBandId, ...GradeBandId[]];

export function gradeBandLabel(id: string | null | undefined): string | null {
  return GRADE_BANDS.find((b) => b.id === id)?.label ?? null;
}

export const DIFFICULTY_OPTIONS = [
  { id: "BELOW", label: "below grade level" },
  { id: "AT", label: "at grade level" },
  { id: "ABOVE", label: "above grade level" },
] as const;

export type DifficultyId = (typeof DIFFICULTY_OPTIONS)[number]["id"];
export const DIFFICULTY_IDS = DIFFICULTY_OPTIONS.map((d) => d.id) as [DifficultyId, ...DifficultyId[]];

export function difficultyLabel(id: string | null | undefined): string | null {
  return DIFFICULTY_OPTIONS.find((d) => d.id === id)?.label ?? null;
}

// Map an integer spine grade level (0 = Kindergarten … 12) to a band. For prefilling the audience
// from a Spine objective's gradeLevel and for the grade-sensitive block tailoring.
export function gradeLevelToBand(gradeLevel: number | null | undefined): GradeBandId | null {
  if (gradeLevel == null) return null;
  if (gradeLevel <= 2) return "EARLY_ELEMENTARY";
  if (gradeLevel <= 5) return "UPPER_ELEMENTARY";
  if (gradeLevel <= 8) return "MIDDLE";
  return "HIGH";
}

// Map a Learner.currentGrade string ("Kindergarten", "3rd Grade", "11th Grade", …) to a band.
// Falls back to null when unparseable (e.g. adult learners / unset grade) — callers then omit
// grade-specific tailoring rather than guessing.
export function gradeStringToBand(currentGrade: string | null | undefined): GradeBandId | null {
  if (!currentGrade) return null;
  if (/kinder|(^|\b)k($|\b)/i.test(currentGrade)) return "EARLY_ELEMENTARY";
  const n = currentGrade.match(/\d{1,2}/);
  return n ? gradeLevelToBand(Number(n[0])) : null;
}

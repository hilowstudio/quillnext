import { describe, it, expect } from "vitest";
import {
  BLOCK_KIND_ALLOWED_PARENTS,
  validateBlockNesting,
  createCourseApiSchema,
  createActivityApiSchema,
  type CourseBlockKind,
} from "./courses";

const ALL_KINDS: CourseBlockKind[] = ["UNIT", "MODULE", "SECTION", "CHAPTER", "LESSON"];

describe("validateBlockNesting", () => {
  it("allows any kind at the top level (null parent)", () => {
    for (const kind of ALL_KINDS) {
      expect(validateBlockNesting(kind, null)).toEqual({ ok: true });
    }
  });

  it("rejects a UNIT under any parent (units are top-level only)", () => {
    for (const parent of ALL_KINDS) {
      expect(validateBlockNesting("UNIT", parent).ok).toBe(false);
    }
  });

  it("allows a MODULE only under a UNIT", () => {
    expect(validateBlockNesting("MODULE", "UNIT")).toEqual({ ok: true });
    for (const parent of ["MODULE", "SECTION", "CHAPTER", "LESSON"] as CourseBlockKind[]) {
      expect(validateBlockNesting("MODULE", parent).ok).toBe(false);
    }
  });

  it("allows a SECTION under a UNIT or MODULE", () => {
    expect(validateBlockNesting("SECTION", "UNIT")).toEqual({ ok: true });
    expect(validateBlockNesting("SECTION", "MODULE")).toEqual({ ok: true });
    for (const parent of ["SECTION", "CHAPTER", "LESSON"] as CourseBlockKind[]) {
      expect(validateBlockNesting("SECTION", parent).ok).toBe(false);
    }
  });

  it("allows a CHAPTER under a UNIT, MODULE, or SECTION", () => {
    for (const parent of ["UNIT", "MODULE", "SECTION"] as CourseBlockKind[]) {
      expect(validateBlockNesting("CHAPTER", parent)).toEqual({ ok: true });
    }
    for (const parent of ["CHAPTER", "LESSON"] as CourseBlockKind[]) {
      expect(validateBlockNesting("CHAPTER", parent).ok).toBe(false);
    }
  });

  it("allows a LESSON under any kind", () => {
    for (const parent of ALL_KINDS) {
      expect(validateBlockNesting("LESSON", parent)).toEqual({ ok: true });
    }
  });

  it("returns a human-readable error message on an illegal nesting", () => {
    const result = validateBlockNesting("UNIT", "LESSON");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("UNIT");
      expect(result.error).toContain("LESSON");
    }
  });

  it("keeps the allowed-parents map in sync with the client getAvailableParentBlocks rules", () => {
    // Mirrors courses/[id]/blocks/new/page.tsx:189-214
    expect(BLOCK_KIND_ALLOWED_PARENTS).toEqual({
      UNIT: [],
      MODULE: ["UNIT"],
      SECTION: ["UNIT", "MODULE"],
      CHAPTER: ["UNIT", "MODULE", "SECTION"],
      LESSON: ["UNIT", "MODULE", "SECTION", "CHAPTER", "LESSON"],
    });
  });
});

describe("createCourseApiSchema", () => {
  const base = { title: "Algebra I", subjectId: "subj-123" };

  it("accepts a minimal valid body (title + subjectId)", () => {
    const r = createCourseApiSchema.safeParse(base);
    expect(r.success).toBe(true);
  });

  it("accepts a full body with optional description/strand/gradeBand", () => {
    const r = createCourseApiSchema.safeParse({
      ...base,
      description: "An intro course",
      strandId: "strand-1",
      gradeBandId: "gb-1",
    });
    expect(r.success).toBe(true);
  });

  it("accepts `new:<name>` tokens for subjectId/strandId (taxonomy minting is by-design — NOT uuid-only)", () => {
    const r = createCourseApiSchema.safeParse({
      title: "Custom",
      subjectId: "new:Marine Biology",
      strandId: "new:Tide Pools",
    });
    expect(r.success).toBe(true);
  });

  it("accepts null/empty-string for the optional fields the client sends", () => {
    // The client (`courses/new/page.tsx`) sends description="" and strandId/gradeBandId null.
    const r = createCourseApiSchema.safeParse({
      ...base,
      description: "",
      strandId: null,
      gradeBandId: null,
    });
    expect(r.success).toBe(true);
  });

  it("rejects a missing title", () => {
    expect(createCourseApiSchema.safeParse({ subjectId: "s" }).success).toBe(false);
  });

  it("rejects a whitespace-only title (trimmed)", () => {
    // The API gets raw input; the client only disables submit on title.trim().
    expect(createCourseApiSchema.safeParse({ title: "   ", subjectId: "s" }).success).toBe(false);
  });

  it("trims surrounding whitespace from a valid title", () => {
    const r = createCourseApiSchema.safeParse({ title: "  Algebra  ", subjectId: "s" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.title).toBe("Algebra");
  });

  it("rejects a missing subjectId", () => {
    expect(createCourseApiSchema.safeParse({ title: "x" }).success).toBe(false);
  });

  it("rejects an over-long title (bounds stored/oversized input)", () => {
    expect(
      createCourseApiSchema.safeParse({ title: "a".repeat(201), subjectId: "s" }).success,
    ).toBe(false);
  });

  it("rejects an over-long subjectId (bounds the minted taxonomy name length)", () => {
    expect(
      createCourseApiSchema.safeParse({ title: "x", subjectId: "new:" + "a".repeat(260) }).success,
    ).toBe(false);
  });
});

describe("createActivityApiSchema", () => {
  const base = { title: "Read Chapter 5", activityType: "READING" as const };

  it("accepts a minimal valid body (title + activityType)", () => {
    expect(createActivityApiSchema.safeParse(base).success).toBe(true);
  });

  it("accepts a full body (description, objectiveId, estimatedMinutes)", () => {
    const r = createActivityApiSchema.safeParse({
      ...base,
      description: "Read pages 80-95 and take notes",
      objectiveId: "obj-123",
      estimatedMinutes: 30,
    });
    expect(r.success).toBe(true);
  });

  it("accepts every ActivityType enum value (kept in sync with schema.prisma)", () => {
    for (const activityType of ["READING", "WRITING", "DISCUSSION", "PROJECT", "LAB", "WORKSHEET", "OTHER"]) {
      expect(createActivityApiSchema.safeParse({ title: "x", activityType }).success).toBe(true);
    }
  });

  it("rejects an unknown activityType", () => {
    expect(createActivityApiSchema.safeParse({ title: "x", activityType: "QUIZ" }).success).toBe(false);
  });

  it("rejects a missing activityType", () => {
    expect(createActivityApiSchema.safeParse({ title: "x" }).success).toBe(false);
  });

  it("rejects a missing title", () => {
    expect(createActivityApiSchema.safeParse({ activityType: "READING" }).success).toBe(false);
  });

  it("rejects a whitespace-only title (trimmed; the API gets raw input)", () => {
    expect(createActivityApiSchema.safeParse({ title: "   ", activityType: "READING" }).success).toBe(false);
  });

  it("trims surrounding whitespace from a valid title", () => {
    const r = createActivityApiSchema.safeParse({ title: "  Lab Safety  ", activityType: "LAB" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.title).toBe("Lab Safety");
  });

  it("coerces a numeric-string estimatedMinutes to a number (JSON body may carry a string)", () => {
    const r = createActivityApiSchema.safeParse({ ...base, estimatedMinutes: "45" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.estimatedMinutes).toBe(45);
  });

  it("rejects a non-positive or non-integer estimatedMinutes", () => {
    expect(createActivityApiSchema.safeParse({ ...base, estimatedMinutes: 0 }).success).toBe(false);
    expect(createActivityApiSchema.safeParse({ ...base, estimatedMinutes: -5 }).success).toBe(false);
    expect(createActivityApiSchema.safeParse({ ...base, estimatedMinutes: 1.5 }).success).toBe(false);
  });

  it("accepts omitted/null optional fields (description, objectiveId, estimatedMinutes)", () => {
    expect(
      createActivityApiSchema.safeParse({
        ...base,
        description: null,
        objectiveId: null,
        estimatedMinutes: null,
      }).success,
    ).toBe(true);
  });

  it("rejects an over-long title", () => {
    expect(
      createActivityApiSchema.safeParse({ title: "a".repeat(201), activityType: "OTHER" }).success,
    ).toBe(false);
  });

  it("rejects an over-long objectiveId (bounds input)", () => {
    expect(
      createActivityApiSchema.safeParse({ ...base, objectiveId: "a".repeat(256) }).success,
    ).toBe(false);
  });
});

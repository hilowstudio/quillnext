import { describe, it, expect } from "vitest";
import { gradeAttemptApiSchema, gradingMethodSchema } from "./grading";

describe("gradingMethodSchema", () => {
  it("accepts the three Prisma GradingMethod values", () => {
    for (const v of ["AUTO", "AI_ASSISTED", "MANUAL"]) {
      expect(gradingMethodSchema.safeParse(v).success).toBe(true);
    }
  });

  it("rejects any other string", () => {
    for (const v of ["", "ai_assisted", "PEER", "HUMAN"]) {
      expect(gradingMethodSchema.safeParse(v).success).toBe(false);
    }
  });
});

describe("gradeAttemptApiSchema", () => {
  it("accepts an empty body (every field optional)", () => {
    const r = gradeAttemptApiSchema.safeParse({});
    expect(r.success).toBe(true);
  });

  it("accepts a full, well-formed body", () => {
    const r = gradeAttemptApiSchema.safeParse({
      feedback: "Great work overall.",
      itemScores: { item1: 5, item2: 0 },
      itemFeedback: { item1: "Correct." },
      gradingMethod: "MANUAL",
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.itemScores).toEqual({ item1: 5, item2: 0 });
      expect(r.data.gradingMethod).toBe("MANUAL");
    }
  });

  it("coerces numeric-string item scores to numbers", () => {
    const r = gradeAttemptApiSchema.safeParse({ itemScores: { item1: "7" } });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.itemScores).toEqual({ item1: 7 });
  });

  it("rejects negative item scores", () => {
    expect(gradeAttemptApiSchema.safeParse({ itemScores: { item1: -1 } }).success).toBe(false);
  });

  it("rejects non-finite item scores (NaN / Infinity)", () => {
    expect(gradeAttemptApiSchema.safeParse({ itemScores: { item1: Infinity } }).success).toBe(false);
    expect(gradeAttemptApiSchema.safeParse({ itemScores: { item1: NaN } }).success).toBe(false);
  });

  it("rejects an invalid gradingMethod enum value", () => {
    expect(gradeAttemptApiSchema.safeParse({ gradingMethod: "BOGUS" }).success).toBe(false);
  });

  it("rejects over-long feedback / itemFeedback strings", () => {
    const long = "x".repeat(10001);
    expect(gradeAttemptApiSchema.safeParse({ feedback: long }).success).toBe(false);
    expect(gradeAttemptApiSchema.safeParse({ itemFeedback: { i: long } }).success).toBe(false);
  });

  it("accepts null feedback", () => {
    expect(gradeAttemptApiSchema.safeParse({ feedback: null }).success).toBe(true);
  });

  it("strips client-supplied scorePoints/maxPoints (server recomputes them)", () => {
    const r = gradeAttemptApiSchema.safeParse({ scorePoints: 9999, maxPoints: -5, itemScores: { i: 1 } });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data).not.toHaveProperty("scorePoints");
      expect(r.data).not.toHaveProperty("maxPoints");
      expect(r.data.itemScores).toEqual({ i: 1 });
    }
  });
});

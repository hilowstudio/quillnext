import { describe, it, expect } from "vitest";
import { serializeMasterContext } from "./context-serializer";
import type { MasterContext, AcademicContext, FamilyContext } from "./master-context";

// Q-09-006: truncateContext used to classify every headerless line as "other"
// (priorities.indexOf("other") === -1 → sorted FIRST), which hoisted section
// detail lines and the injected PHILOSOPHY_PROMPTS blob above their own headers
// and scrambled the prompt whenever serialized context exceeded maxTokens. These
// tests lock the carry-forward classifier: kept sections stay in original order
// and the philosophy block always travels with its FAMILY header.

function makeAcademic(): AcademicContext {
  return {
    objective: {
      id: "obj1",
      code: "M.1.1",
      text: "Add single-digit numbers",
      complexity: 2,
      gradeLevel: 1,
      sortOrder: 0,
    },
    hierarchy: {
      subject: { id: "s1", code: "MATH", name: "Mathematics" },
      strand: { id: "st1", code: "NUM", name: "Number" },
      topic: { id: "t1", code: "ADD", name: "Addition" },
      subtopic: { id: "sub1", code: "ADD1", name: "Single-digit addition" },
    },
    fullPath: "Mathematics > Number > Addition > Single-digit addition",
  };
}

function makeFamily(): FamilyContext {
  return {
    classroom: {
      name: "The Maple Family School",
      description: "A cozy homeschool",
      // matches a PHILOSOPHY_PROMPTS key so the headerless mental-model blob is injected
      educationalPhilosophy: "CHARLOTTE_MASON",
      educationalPhilosophyOther: null,
      faithBackground: "Christian",
      faithBackgroundOther: null,
      schoolYearStartDate: new Date("2025-09-01"),
      schoolYearEndDate: new Date("2026-06-15"),
      schoolDaysOfWeek: [1, 2, 3, 4, 5],
      dailyStartTime: null,
      dailyEndTime: null,
    },
    instructors: [
      { firstName: "Mom", lastName: null, whatStudentsCall: null, role: "TEACHER" },
    ],
    holidays: [],
  };
}

function makeContext(over: Partial<MasterContext> = {}): MasterContext {
  return {
    family: null,
    student: null,
    academic: null,
    library: null,
    schedule: null,
    metadata: {
      contextCompleteness: {
        family: false,
        student: false,
        academic: false,
        library: false,
        schedule: false,
      },
      generatedAt: new Date("2026-06-20"),
    },
    ...over,
  };
}

describe("serializeMasterContext truncation (Q-09-006)", () => {
  it("returns the full serialization in priority order when under the token budget", () => {
    const ctx = makeContext({ academic: makeAcademic(), family: makeFamily() });
    const full = serializeMasterContext(ctx, { maxTokens: 100000 });

    expect(full).toContain("ACADEMIC CONTEXT:");
    expect(full).toContain("FAMILY EDUCATIONAL CONTEXT:");
    expect(full).toContain("PEDAGOGICAL METHOD: CHARLOTTE MASON");
    // default prioritize puts academic before family
    expect(full.indexOf("ACADEMIC CONTEXT:")).toBeLessThan(
      full.indexOf("FAMILY EDUCATIONAL CONTEXT:"),
    );
    // the injected philosophy blob sits inside the family block, after its header
    expect(full.indexOf("FAMILY EDUCATIONAL CONTEXT:")).toBeLessThan(
      full.indexOf("PEDAGOGICAL METHOD"),
    );
  });

  it("preserves document order under truncation and never hoists headerless lines above their header", () => {
    const ctx = makeContext({ academic: makeAcademic(), family: makeFamily() });
    const full = serializeMasterContext(ctx, { maxTokens: 100000 });
    const fullTokens = Math.ceil(full.length / 4);

    // budget below the full size forces truncation but leaves room for academic
    const truncated = serializeMasterContext(ctx, {
      maxTokens: Math.floor(fullTokens / 2),
    });

    expect(truncated).not.toEqual(full); // truncation actually fired
    // the first non-empty line is a real header, NOT a hoisted detail/philosophy line
    const firstLine = truncated.split("\n").find((l) => l.trim().length > 0);
    expect(firstLine).toBe("ACADEMIC CONTEXT:");
    // if any family content survives, the family header still precedes the philosophy blob
    if (truncated.includes("PEDAGOGICAL METHOD")) {
      expect(truncated.indexOf("FAMILY EDUCATIONAL CONTEXT:")).toBeLessThan(
        truncated.indexOf("PEDAGOGICAL METHOD"),
      );
    }
  });

  it("sheds the lowest-priority section first, keeping the highest-priority one intact", () => {
    // family is lower priority than academic by default; with a tight budget the
    // family block (incl. its large philosophy blob) is dropped while academic survives.
    const ctx = makeContext({ academic: makeAcademic(), family: makeFamily() });
    const academicOnly = serializeMasterContext(makeContext({ academic: makeAcademic() }), {
      maxTokens: 100000,
    });
    const academicTokens = Math.ceil(academicOnly.length / 4);

    const truncated = serializeMasterContext(ctx, { maxTokens: academicTokens });

    expect(truncated).toContain("ACADEMIC CONTEXT:");
    expect(truncated).not.toContain("PEDAGOGICAL METHOD");
  });
});

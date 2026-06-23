import { describe, it, expect } from "vitest";
import { generateResourceSchema, distributeCourseSchema } from "./actions";

/**
 * Shape-lock for the generation input contract (Q-10-004). This schema is wired into the
 * browser-facing `generateResource` server action (the only client-reachable generation
 * entry — the Inngest compiler calls generateResourceCore directly). The invariants below
 * are load-bearing: getting them wrong silently breaks valid Quick-Create requests.
 *
 *  - It MUST accept all 5 spine-level sourceTypes (SUBJECT/STRAND/TOPIC_NODE/SUBTOPIC/
 *    OBJECTIVE) — GeneratorsClient sends spineSelection.level as the sourceType.
 *  - additionalData.url MUST NOT be a strict `.url()` — the field has no client validation and
 *    the core embeds it verbatim into a prompt (it tolerates scheme-less domains / topic
 *    phrases). A strict URL check would reject common valid input (the regression the
 *    adversarial pass caught).
 *  - sourceId MUST stay a non-empty string, NOT `.uuid()` — URL/TOPIC/FILE pass non-UUID ids
 *    (e.g. the literal "topic"/"file" or a raw URL).
 *  - additionalData MUST carry sectionNumber + subject (the live code reads them).
 */
describe("generateResourceSchema", () => {
  it("accepts a real BOOK Quick-Create payload", () => {
    const r = generateResourceSchema.safeParse({
      sourceId: "11111111-1111-4111-8111-111111111111",
      sourceType: "BOOK",
      resourceKindId: "22222222-2222-4222-8222-222222222222",
      instructions: "Make it engaging.",
      additionalData: { sectionNumber: 3 },
    });
    expect(r.success).toBe(true);
  });

  it("accepts all 5 spine-level source types with a non-UUID-shaped node id + subject override", () => {
    for (const level of ["SUBJECT", "STRAND", "TOPIC_NODE", "SUBTOPIC", "OBJECTIVE"]) {
      const r = generateResourceSchema.safeParse({
        sourceId: "node-123",
        sourceType: level,
        resourceKindId: "22222222-2222-4222-8222-222222222222",
        additionalData: { subject: "Mathematics" },
      });
      expect(r.success, `${level} should parse`).toBe(true);
    }
  });

  it("accepts a scheme-less / phrase-like URL value (url is NOT a strict .url())", () => {
    const r = generateResourceSchema.safeParse({
      sourceId: "example.com/article",
      sourceType: "URL",
      resourceKindId: "22222222-2222-4222-8222-222222222222",
      additionalData: { url: "example.com/article" },
    });
    expect(r.success).toBe(true);
  });

  it("accepts the TOPIC payload whose sourceId is the literal 'topic'", () => {
    const r = generateResourceSchema.safeParse({
      sourceId: "topic",
      sourceType: "TOPIC",
      resourceKindId: "22222222-2222-4222-8222-222222222222",
      additionalData: { topicText: "Fractions" },
    });
    expect(r.success).toBe(true);
  });

  it("rejects an unknown sourceType (fail fast, not a paid model call)", () => {
    const r = generateResourceSchema.safeParse({
      sourceId: "x",
      sourceType: "SPINE", // GeneratorsClient maps SPINE → a concrete level; the literal is invalid
      resourceKindId: "22222222-2222-4222-8222-222222222222",
    });
    expect(r.success).toBe(false);
  });

  it("rejects an empty sourceId and a non-UUID resourceKindId", () => {
    expect(
      generateResourceSchema.safeParse({
        sourceId: "",
        sourceType: "BOOK",
        resourceKindId: "22222222-2222-4222-8222-222222222222",
      }).success,
    ).toBe(false);
    expect(
      generateResourceSchema.safeParse({
        sourceId: "ok",
        sourceType: "BOOK",
        resourceKindId: "not-a-uuid",
      }).success,
    ).toBe(false);
  });

  it("rejects an over-cap instructions string (token-cost bound)", () => {
    const r = generateResourceSchema.safeParse({
      sourceId: "ok",
      sourceType: "BOOK",
      resourceKindId: "22222222-2222-4222-8222-222222222222",
      instructions: "a".repeat(8001),
    });
    expect(r.success).toBe(false);
  });
});

/** Shape-lock for distributeCourseSchema, now wired into `distributeCourse` (Q-21-002). */
describe("distributeCourseSchema", () => {
  const UUID = "11111111-1111-4111-8111-111111111111";
  it("accepts valid uuids, with the date optional (string or Date)", () => {
    expect(distributeCourseSchema.safeParse({ courseId: UUID, studentId: UUID }).success).toBe(true);
    expect(distributeCourseSchema.safeParse({ courseId: UUID, studentId: UUID, startDate: "2026-01-05" }).success).toBe(true);
    expect(distributeCourseSchema.safeParse({ courseId: UUID, studentId: UUID, startDate: new Date() }).success).toBe(true);
  });
  it("rejects a non-uuid courseId or studentId", () => {
    expect(distributeCourseSchema.safeParse({ courseId: "nope", studentId: UUID }).success).toBe(false);
    expect(distributeCourseSchema.safeParse({ courseId: UUID, studentId: "nope" }).success).toBe(false);
  });
});

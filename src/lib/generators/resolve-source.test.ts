import { describe, it, expect } from "vitest";
import { resolveGenerationSource } from "./resolve-source";

/**
 * Shape-lock for the Q-09-005 consolidation mapper. The generator UI carries several context dims at
 * once (book/video/objective/course/…), but generateResourceCore takes ONE (sourceType, sourceId).
 * This maps them by precedence — most source-specific first so source-grounded RAG kicks in — and falls
 * back to TOPIC(prompt) when no source is given. These tests fail if the precedence changes or the
 * TOPIC fallback drops the prompt.
 */
describe("resolveGenerationSource (Q-09-005)", () => {
    it("prefers a book over everything else", () => {
        expect(
            resolveGenerationSource(
                { bookId: "b1", videoId: "v1", objectiveId: "o1", courseId: "c1" },
                "make a quiz",
            ),
        ).toEqual({ sourceId: "b1", sourceType: "BOOK" });
    });

    it("uses a video when there is no book", () => {
        expect(resolveGenerationSource({ videoId: "v1", objectiveId: "o1", courseId: "c1" }, "p")).toEqual({
            sourceId: "v1",
            sourceType: "VIDEO",
        });
    });

    it("uses the objective (a spine source) when there is no book/video", () => {
        expect(resolveGenerationSource({ objectiveId: "o1", courseId: "c1" }, "p")).toEqual({
            sourceId: "o1",
            sourceType: "OBJECTIVE",
        });
    });

    it("uses the course when only a course is present", () => {
        expect(resolveGenerationSource({ courseId: "c1" }, "p")).toEqual({ sourceId: "c1", sourceType: "COURSE" });
    });

    it("falls back to TOPIC(prompt) when no source dimension is present (e.g. article/document only)", () => {
        expect(resolveGenerationSource({ articleId: "a1", documentId: "d1" }, "explain photosynthesis")).toEqual({
            sourceId: "explain photosynthesis",
            sourceType: "TOPIC",
            additionalData: { topicText: "explain photosynthesis" },
        });
    });

    it("falls back to TOPIC(prompt) with no context at all", () => {
        expect(resolveGenerationSource({}, "long division practice")).toEqual({
            sourceId: "long division practice",
            sourceType: "TOPIC",
            additionalData: { topicText: "long division practice" },
        });
    });
});

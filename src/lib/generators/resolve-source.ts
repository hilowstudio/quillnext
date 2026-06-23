import type { GenerateResourceCoreParams } from "@/app/actions/generate-resource-core";

type SourceType = GenerateResourceCoreParams["sourceType"];

export interface GenerationContextParams {
    studentId?: string;
    objectiveId?: string;
    courseId?: string;
    courseBlockId?: string;
    bookId?: string;
    videoId?: string;
    articleId?: string;
    documentId?: string;
}

export interface ResolvedGenerationSource {
    sourceId: string;
    sourceType: SourceType;
    additionalData?: { topicText?: string };
}

/**
 * Maps the generator UI's multi-dimensional context to the single (sourceType, sourceId) that
 * `generateResourceCore` consumes (Q-09-005 consolidation). Precedence picks the most source-specific
 * anchor first, so source-grounded RAG kicks in (a chosen book/video drives generation); it falls back
 * to TOPIC(prompt) when no source dimension is present.
 *
 * NOTE: `generateResourceCore` has no ARTICLE/DOCUMENT source type, so an article/document-only context
 * also falls back to TOPIC(prompt) — i.e. ungrounded. Adding those source types is future work.
 */
export function resolveGenerationSource(
    params: GenerationContextParams,
    userPrompt: string,
): ResolvedGenerationSource {
    if (params.bookId) return { sourceId: params.bookId, sourceType: "BOOK" };
    if (params.videoId) return { sourceId: params.videoId, sourceType: "VIDEO" };
    if (params.objectiveId) return { sourceId: params.objectiveId, sourceType: "OBJECTIVE" };
    if (params.courseId) return { sourceId: params.courseId, sourceType: "COURSE" };
    return { sourceId: userPrompt, sourceType: "TOPIC", additionalData: { topicText: userPrompt } };
}

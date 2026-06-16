import { generateObject } from "ai";
import { z } from "zod";
import { models } from "@/lib/ai/config";
import { extractVideoContent } from "@/lib/ai/video-processing";

/**
 * video-extraction.ts — the transcript-first PRODUCER core for the cross-org
 * shared VIDEO EXTRACTION feature. Mirrors book-extraction.ts (extractBookGrounded):
 * it is the producer half of the feature and NEVER throws — on any failure it
 * degrades gracefully so the worker can always record a status and a
 * `VideoExtractionResult` is always returned.
 *
 * TWO PATHS:
 *   1) TRANSCRIPT (preferred) — when a real YouTube transcript is available, summarize
 *      the timestamped transcript with generateObject(models.pro). Stage "transcript".
 *   2) GEMINI FALLBACK — when no transcript exists, defer to the existing
 *      extractVideoContent(url) (Gemini 3 Pro "watches" the video) and map its
 *      summary/keyPoints into the result. Stage "gemini-fallback".
 *
 * If BOTH paths fail (or produce nothing usable), return an empty result with
 * stage "manual-needed".
 */

export type VideoExtractionStage = "transcript" | "gemini-fallback" | "manual-needed";

export interface VideoExtractionResult {
  summary: string | null;
  keyPoints: string[];
  chapters: Array<{ title: string; timestamp: string }>;
  topics: string[];
  stage: VideoExtractionStage;
}

/**
 * Zod schema for the TRANSCRIPT path. The model summarizes the timestamped
 * transcript into a concise summary, key points, [MM:SS] chapters, and topics.
 */
const videoExtractionSchema = z.object({
  summary: z.string(),
  keyPoints: z.array(z.string()),
  chapters: z.array(
    z.object({
      title: z.string(),
      timestamp: z.string(),
    }),
  ),
  topics: z.array(z.string()),
});

/** Very long videos: cap the transcript fed to the model to keep the call bounded. */
const MAX_TRANSCRIPT_CHARS = 80_000;

/** Empty/degraded result flagged for manual entry. */
const EMPTY_RESULT: VideoExtractionResult = {
  summary: null,
  keyPoints: [],
  chapters: [],
  topics: [],
  stage: "manual-needed",
};

/**
 * Extract structured video information.
 * NEVER throws — always resolves to a VideoExtractionResult (possibly a degraded fallback).
 */
export async function extractVideoStructured(input: {
  url: string;
  title?: string | null;
  transcript: { raw: string; timestamped: string; available: boolean };
}): Promise<VideoExtractionResult> {
  const { url, title, transcript } = input;

  // ---- PATH 1: TRANSCRIPT — summarize the real captions. ----
  if (transcript.available && transcript.timestamped.trim().length > 0) {
    try {
      const truncated = transcript.timestamped.slice(0, MAX_TRANSCRIPT_CHARS);
      const titleLine = title ? `Video title: ${title}\n\n` : "";

      const { object } = await generateObject({
        model: models.pro,
        schema: videoExtractionSchema,
        prompt:
          `Summarize this YouTube video from its transcript. The transcript is timestamped ` +
          `as "[MM:SS] text" lines. Produce:\n` +
          `1. A concise, factual summary of what the video covers (1-3 paragraphs).\n` +
          `2. 4-8 key points — the most important takeaways, as short standalone statements.\n` +
          `3. Chapters: the natural sections of the video, each with a short title and a ` +
          `"timestamp" in MM:SS form taken from where that section begins in the transcript. ` +
          `Use the real timestamps from the transcript; do not invent them.\n` +
          `4. Topics: the subjects/themes the video covers, as short tags.\n` +
          `Stay grounded in the transcript — do not add information that is not present.\n\n` +
          `${titleLine}Transcript:\n${truncated}`,
      });

      return {
        summary: object.summary ?? null,
        keyPoints: object.keyPoints ?? [],
        chapters: object.chapters ?? [],
        topics: object.topics ?? [],
        stage: "transcript",
      };
    } catch (error) {
      console.error(
        `[video-extraction] transcript path failed for "${url}" — falling back to Gemini watch.`,
        error,
      );
      // Fall through to the Gemini-watch fallback below.
    }
  }

  // ---- PATH 2: GEMINI FALLBACK — let Gemini 3 Pro watch the video directly. ----
  try {
    const content = await extractVideoContent(url);
    return {
      summary: content.summary ?? null,
      keyPoints: content.keyPoints ?? [],
      chapters: [],
      topics: [],
      stage: "gemini-fallback",
    };
  } catch (error) {
    console.error(
      `[video-extraction] gemini-fallback path failed for "${url}" — returning manual-needed.`,
      error,
    );
    return EMPTY_RESULT;
  }
}

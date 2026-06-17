import { generateObject } from "ai";
import { z } from "zod";
import { models } from "@/lib/ai/config";
import { extractVideoContent } from "@/lib/ai/video-processing";

/**
 * video-extraction.ts — the transcript-first PRODUCER core for the cross-org
 * shared VIDEO EXTRACTION feature. Mirrors book-extraction.ts: the two paths are exposed as
 * two separately-callable producers so the worker can run each as its own bounded Inngest step.
 *
 * TWO PATHS:
 *   1) TRANSCRIPT (preferred) — summarizeVideoTranscript: when a real YouTube transcript is
 *      available, summarize the timestamped transcript with generateObject(models.pro). Stage
 *      "transcript". THROWS on failure / no usable transcript so the caller can fall through.
 *   2) GEMINI FALLBACK — watchVideoFallback: defer to extractVideoContent(url) (Gemini "watches"
 *      the video). Stage "gemini-fallback". NEVER throws — degrades to a "manual-needed" result.
 *      This is a single irreducible call that can exceed the Hobby 60s ceiling for long videos;
 *      it only runs when captions are unavailable.
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
 * PATH 1 — TRANSCRIPT: summarize the real captions with one generateObject(models.pro) call.
 *
 * THROWS on failure (or when no usable transcript is present) so the caller can fall through to the
 * Gemini-watch fallback. Kept as its own function so the Inngest worker runs it as a SEPARATE step
 * from the (much heavier) watch fallback — on Vercel Hobby each step is one ≤60s invocation, and a
 * failed transcript attempt stacked in front of a full video-watch in a single step could blow that
 * ceiling. The two paths now never share one invocation.
 */
export async function summarizeVideoTranscript(input: {
  title?: string | null;
  transcript: { raw: string; timestamped: string; available: boolean };
}): Promise<VideoExtractionResult> {
  const { title, transcript } = input;
  if (!transcript.available || transcript.timestamped.trim().length === 0) {
    throw new Error("no usable transcript");
  }

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
}

/**
 * PATH 2 — GEMINI FALLBACK: let Gemini watch the video directly (extractVideoContent).
 *
 * NEVER throws — degrades to a manual-needed result on failure. NOTE: this is a single, irreducible
 * video-understanding call that can itself exceed Vercel Hobby's 60s ceiling for longer videos —
 * it's the one path here that decomposition can't shrink. It only runs when captions are
 * unavailable (the uncommon case); transcript-backed videos never reach it.
 */
export async function watchVideoFallback(url: string): Promise<VideoExtractionResult> {
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

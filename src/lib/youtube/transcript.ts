/**
 * transcript.ts — the transcript SOURCE for the cross-org shared VIDEO EXTRACTION feature.
 *
 * `fetchYouTubeTranscript` pulls a YouTube video's caption track (when one is publicly
 * available) and returns both a flat `raw` string and a `[MM:SS]`-prefixed `timestamped`
 * string. It is the transcript-first input to `summarizeVideoTranscript`: when a transcript
 * is available we structure the real captions; otherwise the caller falls back to a
 * Gemini watch-the-video extraction (`watchVideoFallback`).
 *
 * Like the book-extraction producer, the transcript fetch NEVER throws. Many videos have no
 * captions, are region-blocked, or the scraper trips on YouTube markup — in every such case
 * we degrade to `{ raw: "", timestamped: "", available: false }` so the worker keeps running.
 *
 * `chunkTranscript` produces overlapping word-window chunks suitable for embedding.
 */

/** Shape of a single `youtube-transcript` segment (we only rely on `text` + `offset`). */
interface TranscriptSegment {
  text?: unknown;
  offset?: unknown; // milliseconds from the start of the video
  duration?: unknown;
}

/** Zero-pad a non-negative integer to at least two digits. */
function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/**
 * Format a millisecond offset as a `[MM:SS]` timestamp. Minutes are NOT clamped to 60 so
 * long videos read e.g. `[83:07]`. Guards against NaN / negative offsets → `[00:00]`.
 */
function formatTimestamp(offsetMs: number): string {
  const totalSeconds =
    Number.isFinite(offsetMs) && offsetMs > 0 ? Math.floor(offsetMs / 1000) : 0;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `[${pad2(minutes)}:${pad2(seconds)}]`;
}

/** Coerce an unknown segment `offset` (ms) to a finite number, defaulting to 0. */
function toOffsetMs(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

/**
 * Fetch a YouTube video's transcript.
 *
 * NEVER throws. Returns `{ raw, timestamped, available }`:
 * - `available` is true only when at least one non-empty caption segment was found.
 * - `raw` is every segment's text joined by a single space.
 * - `timestamped` is one line per segment: `[MM:SS] text` (offset → MM:SS).
 *
 * On any error (no captions, region block, network/markup failure) or an empty transcript,
 * resolves to `{ raw: "", timestamped: "", available: false }`.
 */
export async function fetchYouTubeTranscript(
  videoId: string,
): Promise<{ raw: string; timestamped: string; available: boolean }> {
  const empty = { raw: "", timestamped: "", available: false };

  if (!videoId || typeof videoId !== "string") return empty;

  try {
    // Dynamic import so this CJS dependency never breaks the bundle / ESM graph at load time,
    // and so a missing/optional package degrades gracefully instead of crashing the worker.
    const mod = (await import("youtube-transcript")) as {
      YoutubeTranscript?: {
        fetchTranscript?: (id: string) => Promise<TranscriptSegment[]>;
      };
      default?: {
        YoutubeTranscript?: {
          fetchTranscript?: (id: string) => Promise<TranscriptSegment[]>;
        };
      };
    };

    // Guard the export shape: named `YoutubeTranscript`, or nested under a CJS default.
    const YoutubeTranscript =
      mod.YoutubeTranscript ?? mod.default?.YoutubeTranscript;
    if (!YoutubeTranscript || typeof YoutubeTranscript.fetchTranscript !== "function") {
      return empty;
    }

    const segments = await YoutubeTranscript.fetchTranscript(videoId);
    if (!Array.isArray(segments) || segments.length === 0) return empty;

    const rawParts: string[] = [];
    const timestampedLines: string[] = [];

    for (const segment of segments) {
      if (!segment || typeof segment !== "object") continue;
      const rawText = (segment as TranscriptSegment).text;
      const text = typeof rawText === "string" ? rawText.trim() : "";
      if (!text) continue;
      rawParts.push(text);
      const stamp = formatTimestamp(toOffsetMs((segment as TranscriptSegment).offset));
      timestampedLines.push(`${stamp} ${text}`);
    }

    if (rawParts.length === 0) return empty;

    return {
      raw: rawParts.join(" "),
      timestamped: timestampedLines.join("\n"),
      available: true,
    };
  } catch (error) {
    // No captions / region block / scraper failure — degrade silently like the book producer.
    console.error(`[youtube-transcript] fetchYouTubeTranscript failed for "${videoId}"`, error);
    return empty;
  }
}

/**
 * Split a transcript into overlapping word-window chunks for embedding.
 *
 * Window: 300 words, 50-word overlap (i.e. step 250 words). Chunks shorter than 50
 * characters (after trimming) are dropped so trailing fragments don't pollute the index.
 * Returns `[]` for empty/whitespace input.
 */
export function chunkTranscript(text: string): string[] {
  if (!text || typeof text !== "string") return [];

  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];

  const WINDOW = 300;
  const OVERLAP = 50;
  const STEP = WINDOW - OVERLAP; // 250

  const chunks: string[] = [];
  for (let start = 0; start < words.length; start += STEP) {
    const chunk = words.slice(start, start + WINDOW).join(" ").trim();
    if (chunk.length >= 50) chunks.push(chunk);
    if (start + WINDOW >= words.length) break; // last window covered the tail
  }

  return chunks;
}

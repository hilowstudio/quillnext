import { generateObject } from "ai";
import { models } from "./config";
import { z } from "zod";

/**
 * Video Processing Utilities
 *
 * ⚠️ IMPORTANT: Only Gemini 3 Pro can process YouTube videos.
 * All video processing functions MUST use models.pro3
 */

/**
 * Generate structured content from YouTube video.
 * This is the NO-CAPTIONS Gemini-watch fallback used by the transcript-first
 * extraction pipeline (see extractVideoStructured in ./video-extraction): when a
 * YouTube transcript is unavailable, Gemini 3 Pro "watches" the video directly.
 */
const VideoContentSchema = z.object({
  summary: z.string().describe("Comprehensive summary of video content"),
  keyPoints: z.array(z.string()).describe("Main learning points from the video"),
  suggestedActivities: z.array(z.string()).describe("Activities that could be based on this video"),
  difficultyLevel: z.enum(["elementary", "middle", "high", "college"]).describe("Appropriate difficulty level"),
  subjectAreas: z.array(z.string()).describe("Subject areas this video covers"),
});

export type VideoContent = z.infer<typeof VideoContentSchema>;

export async function extractVideoContent(youtubeUrl: string): Promise<VideoContent> {
  const { object } = await generateObject({
    model: models.pro3, // REQUIRED: Only Gemini 3 Pro supports YouTube
    schema: VideoContentSchema,
    prompt: `Analyze this YouTube video and extract structured educational content:

URL: ${youtubeUrl}

Extract comprehensive information that can be used for curriculum planning and content generation.`,
  });

  return object;
}

/**
 * Check if a URL is a YouTube URL
 */
export function isYouTubeUrl(url: string): boolean {
  const youtubeRegex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/;
  return youtubeRegex.test(url);
}

/**
 * Extract YouTube video ID from URL
 */
export function extractYouTubeVideoId(url: string): string | null {
  const youtubeRegex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/;
  const match = url.match(youtubeRegex);
  return match ? match[1] : null;
}


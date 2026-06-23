import { revalidateTag } from "next/cache";
import { inngest } from "@/inngest/client";
import { db, withTenant } from "@/server/db";
import { fetchVideoMetadata } from "@/lib/api/youtube";
import { fetchYouTubeTranscript, chunkTranscript } from "@/lib/youtube/transcript";
import {
    summarizeVideoTranscript,
    watchVideoFallback,
    type VideoExtractionResult,
    type VideoExtractionStage,
} from "@/lib/ai/video-extraction";
import { embedVideoChunks } from "@/lib/utils/vector";
import type { VideoStage } from "@/generated/client";

// Map the lib's hyphenated stage union to the DB enum member names (Q-013, migration 17).
const VIDEO_STAGE: Record<VideoExtractionStage, VideoStage> = {
    transcript: "TRANSCRIPT",
    "gemini-fallback": "GEMINI_FALLBACK",
    "manual-needed": "MANUAL_NEEDED",
};

export const extractVideo = inngest.createFunction(
    {
        id: "extract-video",
        retries: 2,
        concurrency: { limit: 2 },
        // Inngest runs this after retries are exhausted. Mark BOTH the global extraction
        // row (context-free) and the triggering VideoResource (org-scoped) FAILED so nothing
        // hangs in EXTRACTING. (`event` here is the inngest/function.failed event; the original
        // trigger payload is at event.data.event.data — same shape as extract-book.ts.)
        onFailure: async ({ event }) => {
            const orig = (event as any)?.data?.event?.data as
                | {
                      videoExtractionId?: string;
                      triggeringVideoId?: string;
                      organizationId?: string;
                      userId?: string | null;
                  }
                | undefined;
            const videoExtractionId = orig?.videoExtractionId;
            const triggeringVideoId = orig?.triggeringVideoId;
            const organizationId = orig?.organizationId;
            const userId = orig?.userId ?? null;

            // Global, context-free table — plain db, USING(true)/WITH CHECK(true) for app_user.
            if (videoExtractionId) {
                await db.videoExtraction
                    .update({ where: { id: videoExtractionId }, data: { status: "FAILED" } })
                    .catch((e) =>
                        console.error(
                            "[extract-video onFailure] failed to mark VideoExtraction FAILED",
                            e,
                        ),
                    );
            }

            // VideoResource is org-scoped; AsyncLocalStorage doesn't reach Prisma in the Inngest
            // runtime, so stamp the tenant explicitly or the FAILED write is silently dropped.
            if (triggeringVideoId && organizationId) {
                await withTenant(
                    (tx) =>
                        tx.videoResource.update({
                            where: { id: triggeringVideoId },
                            data: { extractionStatus: "FAILED" },
                        }),
                    undefined,
                    { organizationId, userId },
                ).catch((e) =>
                    console.error(
                        "[extract-video onFailure] failed to mark VideoResource FAILED",
                        e,
                    ),
                );
            }
        },
    },
    { event: "video/extract.requested" },
    async ({ event, step }) => {
        const { videoExtractionId, triggeringVideoId, organizationId, userId } = event.data;
        // Background worker has no request — AsyncLocalStorage does NOT reach the Prisma layer
        // here. The GLOBAL VideoExtraction row is context-free (read/write with plain db); every
        // org-scoped VideoResource op must thread the tenant EXPLICITLY via withTenant.

        // 1. Load: the GLOBAL extraction row (plain db) for the canonical youtube video id/url.
        //    Also read the triggering VideoResource (org-scoped) for any existing fields.
        const loaded = await step.run("load", async () => {
            const extraction = await db.videoExtraction.findUnique({
                where: { id: videoExtractionId },
            });
            if (!extraction) throw new Error("VideoExtraction not found");

            const video = await withTenant(
                (tx) =>
                    tx.videoResource.findUnique({
                        where: { id: triggeringVideoId },
                        select: { title: true, description: true },
                    }),
                undefined,
                { organizationId, userId },
            );

            return {
                youtubeVideoId: extraction.youtubeVideoId,
                youtubeUrl: extraction.youtubeUrl,
                existingTitle: video?.title ?? null,
            };
        });

        // 2. Metadata: YouTube Data API (never throws → all-null on failure/missing key).
        const metadata = await step.run("metadata", async () => {
            return fetchVideoMetadata(loaded.youtubeVideoId);
        });

        // 3. Transcript: YouTube captions (never throws → empty/unavailable on error).
        const transcript = await step.run("transcript", async () => {
            return fetchYouTubeTranscript(loaded.youtubeVideoId);
        });

        // 4. Structured analysis, split so each Inngest step is ONE AI call (Vercel Hobby's 60s
        //    per-invocation ceiling). 4a TRANSCRIPT summarize (the common path) is its own step; if
        //    there is no usable transcript — or it fails — 4b the Gemini-WATCH fallback runs in a
        //    SEPARATE step, never stacked behind a failed transcript attempt in one invocation.
        //    NOTE: the watch fallback is a single, irreducible video-understanding call that can
        //    itself exceed 60s for long no-caption videos; it only runs when captions are absent.
        let result: VideoExtractionResult | null = null;
        if (transcript.available && transcript.timestamped.trim().length > 0) {
            try {
                result = await step.run("analyze-transcript", async () =>
                    summarizeVideoTranscript({
                        title: metadata.title ?? loaded.existingTitle,
                        transcript,
                    }),
                );
            } catch (e) {
                console.error("[extract-video] transcript analysis failed — trying watch", e);
                result = null;
            }
        }
        if (!result) {
            result = await step.run("analyze-watch", async () =>
                watchVideoFallback(loaded.youtubeUrl),
            );
        }

        // 5. Persist to the GLOBAL extraction row — plain db (context-free global table).
        await step.run("persist-global", async () => {
            await db.videoExtraction.update({
                where: { id: videoExtractionId },
                data: {
                    status: "EXTRACTED",
                    stage: VIDEO_STAGE[result.stage],
                    title: metadata.title,
                    description: metadata.description,
                    thumbnailUrl: metadata.thumbnailUrl,
                    channelName: metadata.channelName,
                    durationSeconds: metadata.durationSeconds,
                    summary: result.summary,
                    keyPoints: result.keyPoints as any,
                    chapters: result.chapters as any,
                    topics: result.topics,
                    transcript: transcript.available ? transcript.raw : null,
                    captionsAvailable: transcript.available,
                    extractedAt: new Date(),
                },
            });
        });

        // 6. Copy down to ONLY the triggering VideoResource (its org is known). Other orgs copy
        //    down lazily via the extract route — do NOT fan out across orgs here.
        await step.run("copy-down", async () => {
            await withTenant(
                (tx) =>
                    tx.videoResource.update({
                        where: { id: triggeringVideoId },
                        data: {
                            title: metadata.title,
                            description: metadata.description,
                            thumbnailUrl: metadata.thumbnailUrl,
                            durationSeconds: metadata.durationSeconds,
                            channelName: metadata.channelName,
                            extractedSummary: result.summary,
                            extractedKeyPoints: result.keyPoints as any,
                            extractedTranscript: transcript.available ? transcript.raw : null,
                            extractionStatus: "EXTRACTED",
                            extractedAt: new Date(),
                            videoExtractionId,
                        },
                    }),
                undefined,
                { organizationId, userId },
            );
            // Invalidate the org's library list so the new summary/metadata surfaces.
            revalidateTag(`library-${organizationId}`, {});
        });

        // 7. Best-effort transcript embedding. embedVideoChunks opens its OWN plain-db writes
        //    against the global chunk table (NOT nested in a withTenant). Failures are non-fatal.
        await step.run("embed-chunks", async () => {
            try {
                if (transcript.available) {
                    await embedVideoChunks(videoExtractionId, chunkTranscript(transcript.raw));
                }
            } catch (e) {
                console.error("[extract-video embed-chunks] non-fatal embedding failure", e);
            }
            return { embedded: transcript.available };
        });

        return { success: true, videoExtractionId, triggeringVideoId };
    },
);

export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { auth } from "@/auth";
import { getCurrentUserOrg } from "@/lib/auth-helpers";
import { db, withTenant } from "@/server/db";
import { inngest } from "@/inngest/client";
import type { Prisma } from "@/generated/client";

/**
 * POST /api/library/videos/[id]/extract
 *
 * Idempotent trigger + poll for the cross-org, transcript-first video extraction.
 *
 * The heavy AI work happens ONCE per real-world YouTube video in the GLOBAL
 * `video_extractions` catalog (deduped on the stable 11-char `youtubeVideoId`). This endpoint:
 *   - If the global row is already EXTRACTED, copies its result DOWN onto THIS org's
 *     VideoResource immediately (the cheap, common "second org" path) and returns EXTRACTED.
 *   - If extraction is in flight (EXTRACTING), links this VideoResource and reports EXTRACTING.
 *     A client polls this same endpoint; once the global row flips to EXTRACTED the first
 *     branch copies it down on the next call.
 *   - Otherwise kicks off the background extraction (Inngest) and reports EXTRACTING+started.
 *
 * Every branch is safe to call repeatedly.
 *
 * RLS: the global `VideoExtraction` is CONTEXT_FREE — read/write with plain `db` (no withTenant).
 * The org-scoped `VideoResource` is always touched inside
 * `withTenant(..., { organizationId, userId })`, which are NEVER nested (each runs in its own tx).
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { organizationId, userId } = await getCurrentUserOrg();
  if (!organizationId) {
    return NextResponse.json({ error: "User has no organization" }, { status: 400 });
  }

  // Load the org-scoped VideoResource (RLS already scopes to this org; an explicit org filter is
  // not needed because findUnique-by-id can't cross tenants under RLS). 404 when absent.
  const video = await withTenant(
    (tx) =>
      tx.videoResource.findUnique({
        where: { id },
        select: {
          id: true,
          youtubeVideoId: true,
          youtubeUrl: true,
          extractionStatus: true,
          videoExtractionId: true,
        },
      }),
    undefined,
    { organizationId, userId },
  );

  if (!video) {
    return NextResponse.json({ error: "Video not found" }, { status: 404 });
  }

  const { youtubeVideoId, youtubeUrl } = video;

  // Find the GLOBAL extraction row (plain db — VideoExtraction is context-free).
  const existing = await db.videoExtraction.findUnique({ where: { youtubeVideoId } });

  // --- Case 1: a completed extraction already exists → copy it DOWN to this org's VideoResource.
  if (existing && existing.status === "EXTRACTED") {
    await withTenant(
      (tx) =>
        tx.videoResource.update({
          where: { id },
          data: {
            title: existing.title,
            description: existing.description,
            thumbnailUrl: existing.thumbnailUrl,
            durationSeconds: existing.durationSeconds,
            channelName: existing.channelName,
            extractedSummary: existing.summary,
            extractedKeyPoints: existing.keyPoints as Prisma.InputJsonValue,
            extractedTranscript: existing.transcript,
            extractionStatus: "EXTRACTED",
            extractedAt: existing.extractedAt ?? new Date(),
            videoExtractionId: existing.id,
          },
        }),
      undefined,
      { organizationId, userId },
    );

    revalidateTag(`library-${organizationId}`, {});
    revalidatePath("/living-library");
    revalidatePath("/library");

    return NextResponse.json({ status: "EXTRACTED", reused: true });
  }

  // --- Case 2: extraction is in flight → link this VideoResource + mark EXTRACTING (poll).
  if (existing && existing.status === "EXTRACTING") {
    await withTenant(
      (tx) =>
        tx.videoResource.update({
          where: { id },
          data: {
            extractionStatus: "EXTRACTING",
            videoExtractionId: existing.id,
          },
        }),
      undefined,
      { organizationId, userId },
    );

    return NextResponse.json({ status: "EXTRACTING" });
  }

  // --- Case 3: no row yet, or a prior NOT_EXTRACTED/FAILED attempt → (re)start extraction.
  // Upsert the GLOBAL row by youtubeVideoId to EXTRACTING (plain db — context-free). The upsert
  // is what makes the "start" path idempotent across orgs: concurrent triggers converge on one row.
  const row = await db.videoExtraction.upsert({
    where: { youtubeVideoId },
    create: {
      youtubeVideoId,
      youtubeUrl,
      status: "EXTRACTING",
    },
    update: {
      status: "EXTRACTING",
    },
  });

  // Link this org's VideoResource to the (re)started extraction + mark EXTRACTING.
  await withTenant(
    (tx) =>
      tx.videoResource.update({
        where: { id },
        data: {
          extractionStatus: "EXTRACTING",
          videoExtractionId: row.id,
        },
      }),
    undefined,
    { organizationId, userId },
  );

  // Kick off the background worker. Threads org/user so the worker stamps RLS on its writes.
  await inngest.send({
    name: "video/extract.requested",
    data: {
      videoExtractionId: row.id,
      triggeringVideoId: id,
      organizationId,
      userId,
    },
  });

  return NextResponse.json({ status: "EXTRACTING", started: true });
}

export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getCurrentUserOrg } from "@/lib/auth-helpers";
import { assertParentProfile } from "@/server/profiles/guards";
import { db, withTenant } from "@/server/db";
import { extractYouTubeVideoId, isYouTubeUrl } from "@/lib/ai/video-processing";
import { revalidateTag } from "next/cache";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { organizationId } = await getCurrentUserOrg();
  if (!organizationId) {
    return NextResponse.json({ error: "User has no organization" }, { status: 400 });
  }

  const videos = await db.videoResource.findMany({
    where: { organizationId },
    include: {
      subject: true,
      strand: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ videos });
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Mutating the org catalog is a parent-only action (defense-in-depth: the proxy does NOT
  // gate /api routes, so a STUDENT-profile session on the shared family login could POST here).
  try {
    await assertParentProfile();
  } catch {
    return NextResponse.json({ error: "This action requires a parent profile." }, { status: 403 });
  }

  const { organizationId, userId } = await getCurrentUserOrg();
  if (!organizationId) {
    return NextResponse.json({ error: "User has no organization" }, { status: 400 });
  }

  const data = await request.json();

  if (!data.youtubeUrl) {
    return NextResponse.json({ error: "YouTube URL required" }, { status: 400 });
  }

  if (!isYouTubeUrl(data.youtubeUrl)) {
    return NextResponse.json({ error: "Invalid YouTube URL" }, { status: 400 });
  }

  const videoId = extractYouTubeVideoId(data.youtubeUrl);
  if (!videoId) {
    return NextResponse.json({ error: "Could not extract video ID" }, { status: 400 });
  }

  // Dedupe WITHIN this org only (youtubeVideoId is unique per (organizationId, youtubeVideoId),
  // NOT globally — other orgs are allowed to add the same video). If this org already has it,
  // return the existing row instead of erroring, so the add is idempotent.
  const existing = await withTenant(
    (tx) =>
      tx.videoResource.findUnique({
        where: {
          organizationId_youtubeVideoId: { organizationId, youtubeVideoId: videoId },
        },
        include: {
          subject: true,
          strand: true,
        },
      }),
    undefined,
    { organizationId, userId },
  );

  if (existing) {
    return NextResponse.json({ video: existing });
  }

  // Verify subject if provided
  if (data.subjectId) {
    const subject = await db.subject.findUnique({
      where: { id: data.subjectId },
    });

    if (!subject) {
      return NextResponse.json({ error: "Subject not found" }, { status: 400 });
    }
  }

  // Verify strand if provided
  if (data.strandId) {
    const strand = await db.strand.findUnique({
      where: { id: data.strandId },
    });

    if (!strand || (data.subjectId && strand.subjectId !== data.subjectId)) {
      return NextResponse.json(
        { error: "Strand not found or doesn't belong to subject" },
        { status: 400 },
      );
    }
  }

  // Create the per-org VideoResource inside withTenant so the RLS WITH CHECK passes (account_id
  // is stamped from the tenant context). No global dup-block — cross-org adds are allowed.
  const video = await withTenant(
    (tx) =>
      tx.videoResource.create({
        data: {
          organizationId,
          addedByUserId: userId,
          youtubeUrl: data.youtubeUrl,
          youtubeVideoId: videoId,
          subjectId: data.subjectId || null,
          strandId: data.strandId || null,
          extractionStatus: "NOT_EXTRACTED",
        },
        include: {
          subject: true,
          strand: true,
        },
      }),
    undefined,
    { organizationId, userId },
  );

  // Bust the cached /living-library catalog so the new video shows immediately in
  // the Videos tab (which reads the cached getLibraryResources). The existing-row
  // early-return above needs none — that row was already in the catalog.
  revalidateTag(`library-${organizationId}`, {});

  return NextResponse.json({ video });
}


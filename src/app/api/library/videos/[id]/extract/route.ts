export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getCurrentUserOrg } from "@/lib/auth-helpers";
import { db } from "@/server/db";
import { extractVideoContent } from "@/lib/ai/video-processing";
import { generateVideoEmbedding } from "@/lib/utils/vector";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { organizationId } = await getCurrentUserOrg();

  const video = await db.videoResource.findUnique({
    where: { id },
  });

  if (!video || video.organizationId !== organizationId) {
    return NextResponse.json({ error: "Video not found" }, { status: 404 });
  }

  // Update status to extracting
  await db.videoResource.update({
    where: { id },
    data: { extractionStatus: "EXTRACTING" },
  });

  try {
    // Extract video content using Gemini 3 Pro
    const extracted = await extractVideoContent(video.youtubeUrl);

    // Update video with extracted content
    await db.videoResource.update({
      where: { id },
      data: {
        extractionStatus: "EXTRACTED",
        extractedAt: new Date(),
        extractedSummary: extracted.summary,
        extractedKeyPoints: extracted.keyPoints,
        // Note: Transcript extraction would require additional processing
        // For now, we store the summary and key points
      },
    });

    // Generate + store the embedding so the video surfaces in semantic search,
    // matching the background video-processor flow. Non-fatal on failure.
    try {
      const textToEmbed = `${extracted.summary}\n\nKey Points:\n${(extracted.keyPoints || []).join("\n")}`;
      await generateVideoEmbedding(id, textToEmbed);
    } catch (embedErr) {
      console.error("Video embedding failed (extraction still saved):", embedErr);
    }

    return NextResponse.json({ success: true, extracted });
  } catch (error) {
    console.error("Video extraction error:", error);

    // Update status to failed
    await db.videoResource.update({
      where: { id },
      data: { extractionStatus: "FAILED" },
    });

    return NextResponse.json(
      { error: "Failed to extract video content" },
      { status: 500 },
    );
  }
}


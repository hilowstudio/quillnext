import { NextRequest, NextResponse } from "next/server";
export const dynamic = "force-dynamic";

import { auth } from "@/auth";
import { db } from "@/server/db";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  // Q-19-001 — require a session (spine is global reference data; no org filter needed).
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const strandId = searchParams.get("strandId");

  if (!strandId) {
    return NextResponse.json({ error: "strandId required" }, { status: 400 });
  }

  const topics = await db.topic.findMany({
    where: {
      strandId,
    },
    select: {
      id: true,
      name: true,
      code: true,
      strandId: true,
    },
    orderBy: {
      sortOrder: "asc",
    },
  });

  return NextResponse.json({ topics });
}

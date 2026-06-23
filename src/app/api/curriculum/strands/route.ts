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
  const subjectId = searchParams.get("subjectId");

  if (!subjectId) {
    return NextResponse.json({ error: "subjectId required" }, { status: 400 });
  }

  const strands = await db.strand.findMany({
    where: {
      subjectId,
    },
    select: {
      id: true,
      name: true,
      code: true,
      subjectId: true,
    },
    orderBy: {
      sortOrder: "asc",
    },
  });

  return NextResponse.json({ strands });
}

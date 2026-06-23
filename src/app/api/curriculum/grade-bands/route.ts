import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";

import { auth } from "@/auth";
import { db } from "@/server/db";

export const runtime = "nodejs";

export async function GET() {
  // Q-19-001 — require a session (grade bands are global reference data; no org filter needed).
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const gradeBands = await db.gradeBand.findMany({
    select: {
      id: true,
      name: true,
      code: true,
      minGrade: true,
      maxGrade: true,
    },
    orderBy: {
      minGrade: "asc",
    },
  });

  return NextResponse.json({ gradeBands });
}

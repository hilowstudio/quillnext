import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";

import { auth } from "@/auth";
import { db } from "@/server/db";

export const runtime = "nodejs";

export async function GET() {
  // Q-19-001 — require a session. The spine is global reference data (no org filter needed); this
  // just closes the unauthenticated-enumeration surface (the proxy matcher excludes /api/*).
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const subjects = await db.subject.findMany({
    select: {
      id: true,
      name: true,
      code: true,
    },
    orderBy: {
      sortOrder: "asc",
    },
  });

  return NextResponse.json({ subjects });
}

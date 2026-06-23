import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";

import { auth } from "@/auth";
import { db } from "@/server/db";

export const runtime = "nodejs";

export async function GET() {
    // Q-19-001 — require a session (resource kinds are global reference data; no org filter needed).
    const session = await auth();
    if (!session?.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const kinds = await db.resourceKind.findMany({
            include: {
                subject: {
                    select: { name: true }
                }
            },
            orderBy: { label: "asc" }
        });

        return NextResponse.json({ kinds });
    } catch (error) {
        console.error("Failed to fetch resource kinds:", error);
        return NextResponse.json({ error: "Failed to fetch resource kinds" }, { status: 500 });
    }
}

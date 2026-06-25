import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";

import { getCurrentUserOrg } from "@/lib/auth-helpers";

export async function GET() {
  try {
    const { userId, organizationId } = await getCurrentUserOrg();
    return NextResponse.json({ userId, organizationId });
  } catch {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }
}


import { NextRequest, NextResponse } from "next/server";
export const dynamic = "force-dynamic";

import { auth } from "@/auth";
import { getCurrentUserOrg } from "@/lib/auth-helpers";
import { getMasterContext } from "@/lib/context/master-context";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // SECURITY: derive the organization from the SESSION — never from the request body.
  // The body only supplies narrowing ids (which are themselves re-validated against the
  // session org downstream, e.g. getStudentContext asserts student.organizationId === org).
  const { organizationId } = await getCurrentUserOrg(session);
  if (!organizationId) {
    return NextResponse.json({ error: "No organization" }, { status: 403 });
  }

  const body = (await request
    .json()
    .catch(() => ({}))) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" ? v : undefined);

  const context = await getMasterContext({
    organizationId,
    studentId: str(body.studentId),
    objectiveId: str(body.objectiveId),
    courseId: str(body.courseId),
    courseBlockId: str(body.courseBlockId),
    bookId: str(body.bookId),
    videoId: str(body.videoId),
    articleId: str(body.articleId),
    documentId: str(body.documentId),
  });

  return NextResponse.json(context);
}

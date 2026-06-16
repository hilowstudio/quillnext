import { db } from "@/server/db";
import { NextResponse } from "next/server";
import { auth } from "@/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Test-only seed endpoint. It must NEVER be reachable in production, and must
// never write to the DB for an anonymous caller (the previous version created a
// "Test Org" + test@example.com user with no auth at all — a public DB-write hole).
export async function GET() {
    if (process.env.NODE_ENV === "production") {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const user = await db.user.findUnique({
            where: { id: session.user.id },
            select: { organizationId: true },
        });
        const organizationId = user?.organizationId;
        if (!organizationId) {
            return NextResponse.json({ error: "Authenticated user has no organization" }, { status: 400 });
        }

        // Subject + ResourceKind are global reference data; Book is org-scoped.
        let subject = await db.subject.findFirst({ where: { name: "Literature" } });
        if (!subject) {
            subject = await db.subject.create({
                data: { name: "Literature", code: "LIT", sortOrder: 1 },
            });
        }

        let book = await db.book.findFirst({ where: { title: "The Hobbit", organizationId } });
        if (!book) {
            book = await db.book.create({
                data: {
                    organizationId,
                    addedByUserId: session.user.id,
                    title: "The Hobbit",
                    authors: ["J.R.R. Tolkien"],
                    description: "A fantasy novel about Bilbo Baggins.",
                    summary:
                        "Bilbo Baggins, a hobbit, is swept into an epic quest to reclaim the lost Kingdom of Erebor from the fearsome dragon Smaug.",
                    subjectId: subject.id,
                    externalSource: "MANUAL",
                    extractionStatus: "EXTRACTED",
                },
            });
        }

        let kind = await db.resourceKind.findFirst({ where: { code: "worksheet_basic" } });
        if (!kind) {
            kind = await db.resourceKind.create({
                data: {
                    code: "worksheet_basic",
                    label: "Basic Worksheet",
                    description: "Standard Q&A worksheet",
                    contentType: "WORKSHEET",
                },
            });
        }

        return NextResponse.json({ success: true, bookId: book.id, userId: session.user.id });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: "Failed to seed: " + (error as Error).message }, { status: 500 });
    }
}

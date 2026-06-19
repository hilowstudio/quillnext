import { streamText } from "ai";
import { getContextForThinkling, ThinklingMode } from "@/lib/thinkling";
import { auth } from "@/auth";
import { getCurrentUserOrg } from "@/lib/auth-helpers";
import { db } from "@/server/db";
export const dynamic = "force-dynamic";
import { models } from "@/lib/ai/config";
import { inngest } from "@/inngest/client";

export const maxDuration = 30;

export async function POST(req: Request) {
    console.log("Thinkling API: Request Received");
    const session = await auth();
    console.log("Thinkling API: Session User:", session?.user?.email || "None");

    if (!session?.user) {
        console.log("Thinkling API: Unauthorized (No Session)");
        return new Response("Unauthorized", { status: 401 });
    }

    const json = await req.json();
    console.log("Thinkling API Request MATCHED:", json);
    let { messages, studentId, mode } = json;

    console.log("Using Model:", models.flash ? "Defined" : "UNDEFINED");

    // Fallback to Query Params if not in body
    if (!studentId || !mode) {
        const url = new URL(req.url);
        if (!studentId) studentId = url.searchParams.get("studentId");
        if (!mode) mode = url.searchParams.get("mode");
    }

    if (!studentId || !mode) {
        console.error("Missing params:", { studentId, mode, json });
        return new Response(JSON.stringify({
            error: "Missing studentId or mode",
            received: json,
            params: { studentId, mode }
        }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    try {
        // Multi-tenant guard: the student (whose full learner profile drives the
        // system prompt) must belong to the caller's organization.
        const { organizationId } = await getCurrentUserOrg();
        const student = await db.learner.findUnique({ where: { id: studentId }, select: { organizationId: true } });
        if (!student || student.organizationId !== organizationId) {
            return new Response("Forbidden", { status: 403 });
        }

        const { systemPrompt } = await getContextForThinkling(studentId, mode as ThinklingMode, organizationId);

        // Convert messages manually to ensure cleaner payload for Google provider
        // Handle cases where 'content' is missing but 'parts' exist (from UIMessage state)
        const coreMessages = messages.map((m: any) => {
            let content = m.content;
            if (!content && m.parts && Array.isArray(m.parts)) {
                content = m.parts.map((p: any) => p.text || '').join('');
            }
            return {
                role: m.role,
                content: content || '' // Ensure it's never undefined
            };
        });

        // SAFETY SCAN: Check the latest user message
        // We trigger this asynchronously via Inngest so it runs in the background
        const lastMessage = coreMessages[coreMessages.length - 1];
        if (lastMessage && lastMessage.role === 'user') {
            // Enqueue the background safety scan. This is a child-safety event, so we must NOT
            // silently drop it (no bare fire-and-forget) — but a transient Inngest enqueue failure
            // must also NOT 500 the chat and deny the student a reply. Log loudly and continue; only
            // the enqueue is awaited here, the scan PROCESSING is async (see safety-scan job).
            try {
                await inngest.send({
                    name: "chat/message.sent",
                    data: {
                        studentId,
                        message: lastMessage.content,
                        // org carried so the background safety scan has RLS tenant context
                        // (non-null: the student-in-org guard above guarantees it)
                        organizationId: organizationId!,
                    }
                });
            } catch (sendErr) {
                console.error("Thinkling: failed to enqueue safety scan (chat/message.sent):", sendErr);
            }
        }

        console.log("StreamText: Starting stream configuration...");
        const result = streamText({
            model: models.flash, // Use Gemini Flash for speed and efficiency
            system: systemPrompt,
            messages: coreMessages,
        });

        // useChat expects structured UI messages; toUIMessageStreamResponse is the AI SDK v5 method.
        return result.toUIMessageStreamResponse();
    } catch (error: any) {
        console.error("Thinkling Error:", error);
        return new Response(JSON.stringify({
            error: "Internal Server Error",
            details: error.message || String(error),
            stack: error.stack
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

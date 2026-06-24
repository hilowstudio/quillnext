import { streamText } from "ai";
import { getContextForThinkling, ThinklingMode } from "@/lib/thinkling";
import { auth } from "@/auth";
import { getCurrentUserOrg } from "@/lib/auth-helpers";
import { db } from "@/server/db";
export const dynamic = "force-dynamic";
import { models } from "@/lib/ai/config";
import { inngest } from "@/inngest/client";
import { persistPendingScan, drainPendingSafetyScans } from "@/lib/safety/pending-scan";

export const maxDuration = 30;

export async function POST(req: Request) {
    const session = await auth();

    if (!session?.user) {
        return new Response("Unauthorized", { status: 401 });
    }

    const json = await req.json();
    const { messages, studentId, mode } = json;

    if (!studentId || !mode) {
        console.error("Thinkling API: missing studentId or mode");
        return new Response(JSON.stringify({ error: "Missing studentId or mode" }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    try {
        // Multi-tenant guard: the student (whose full learner profile drives the system prompt)
        // must belong to the caller's org. RLS is OFF (db.ts:9), so the explicit organizationId
        // predicate in the query is the live tenant boundary — not a droppable post-fetch
        // comparison. Mirrors getSourceMetadata (Q-10-001).
        const { organizationId } = await getCurrentUserOrg();
        if (!organizationId) {
            return new Response("Forbidden", { status: 403 });
        }
        const student = await db.learner.findFirst({
            where: { id: studentId, organizationId },
            select: { id: true },
        });
        if (!student) {
            return new Response("Forbidden", { status: 403 });
        }

        // Opportunistically retry any safety-scans that previously failed to enqueue for this org
        // (Q-12-010, drain-on-next-chat). Runs under the request's org context (RLS-clean); strictly
        // best-effort so a drain hiccup can never break the chat path.
        try {
            await drainPendingSafetyScans(organizationId);
        } catch (drainErr) {
            console.error("Thinkling: failed to drain pending safety scans:", drainErr);
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
            // Recent prior turns (excluding the latest, which is sent as `message`) give the safety
            // scanner cross-turn context so multi-turn grooming/coercion is visible (Q-12-011).
            // Bounded here and again in the scanner; the job persists only the latest-message snippet.
            const conversationContext = coreMessages
                .slice(0, -1)
                .slice(-10)
                .map((m: { role: string; content: string }) => ({ role: m.role, content: m.content }));
            try {
                await inngest.send({
                    name: "chat/message.sent",
                    data: {
                        studentId,
                        message: lastMessage.content,
                        // org carried so the background safety scan has RLS tenant context
                        // (non-null: the `if (!organizationId)` guard above guarantees it)
                        organizationId: organizationId,
                        conversationContext,
                    }
                });
            } catch (sendErr) {
                console.error("Thinkling: failed to enqueue safety scan (chat/message.sent):", sendErr);
                // Durable fallback (Q-12-010): persist the scan so the signal is never lost; the org's
                // next chat request drains it. Best-effort — if this ALSO fails the signal is lost, so
                // log loudly. Never rethrow: the student must still get their reply.
                try {
                    await persistPendingScan({ studentId, message: lastMessage.content, organizationId });
                } catch (persistErr) {
                    console.error("Thinkling: FAILED to persist pending safety scan — signal lost:", persistErr);
                }
            }
        }

        const result = streamText({
            model: models.flash, // Use Gemini Flash for speed and efficiency
            system: systemPrompt,
            messages: coreMessages,
        });

        // useChat expects structured UI messages; toUIMessageStreamResponse is the AI SDK v5 method.
        return result.toUIMessageStreamResponse();
    } catch (error: unknown) {
        console.error("Thinkling Error:", error);
        return new Response(JSON.stringify({ error: "Internal Server Error" }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

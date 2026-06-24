import { inngest } from "@/inngest/client";
import { db, withTenant } from "@/server/db";
import { generateResourceCore } from "@/app/actions/generate-resource-core";
import { NonRetriableError } from "inngest";
import { generateObject } from "ai";
import { z } from "zod";
import { models } from "@/lib/ai/config";
import { setRlsContext } from "@/server/rls-context";
import { createHash } from "crypto";

// Structured verdict the verification gate asks the model to return after reading
// the ACTUAL generated artifacts (not a free-text guess about content it never saw).
const VerificationVerdictSchema = z.object({
    releaseRecommended: z.boolean().describe("False ONLY for a severe, clearly release-blocking problem."),
    readingLevelOk: z.boolean(),
    durationCoverageOk: z.boolean().describe("Does the Teacher Guide plausibly cover the required number of days?"),
    grayscaleSafe: z.boolean().describe("Do the materials avoid relying on color alone to convey meaning?"),
    summary: z.string().describe("One or two sentence overall QA summary."),
    defects: z.array(
        z.object({
            artifact: z.string(),
            severity: z.enum(["critical", "major", "minor"]),
            issue: z.string(),
            recommendation: z.string(),
        }),
    ),
});

function sha256(input: string): string {
    return createHash("sha256").update(input, "utf8").digest("hex");
}

// Resource content is stored as { markdown } for text artifacts, or a structured
// object for JSON artifacts. Return the meaningful text for hashing/review.
function extractContentText(storageType: string, content: unknown): string {
    if (content == null) return "";
    if (storageType === "MARKDOWN" && typeof content === "object" && content !== null && "markdown" in content) {
        const md = (content as { markdown?: unknown }).markdown;
        if (typeof md === "string") return md;
    }
    return typeof content === "string" ? content : JSON.stringify(content);
}

export const compileCurriculum = inngest.createFunction(
    {
        id: "compile-curriculum",
        // Inngest runs this after retries are exhausted. Mark the bundle FAILED so it
        // doesn't hang on COMPILING, and record why. (`event` here is the
        // inngest/function.failed event; the original trigger is at event.data.event.)
        onFailure: async ({ event, error }) => {
            const orig = event.data?.event?.data;
            const bundleId = orig?.bundleId;
            if (!bundleId) return;
            const organizationId = orig?.organizationId;
            if (!organizationId) return;
            const userId = orig?.userId ?? null;
            const failureReason = (error instanceof Error ? error.message : String(error ?? "Unknown error")).slice(0, 1000);
            // curriculum_bundles is org-scoped; in the Inngest runtime AsyncLocalStorage does not
            // reach Prisma, so stamp the tenant explicitly or the FAILED write is silently dropped.
            await withTenant(
                (tx) => tx.curriculumBundle.update({ where: { id: bundleId }, data: { status: "FAILED", failureReason } }),
                undefined,
                { organizationId, userId },
            ).catch((e) => console.error("[compile-curriculum onFailure] failed to mark bundle FAILED", e));
        },
    },
    { event: "curriculum/compile" },
    async ({ event, step, logger }) => {
        const { bundleId, specId, organizationId, userId } = event.data;
        // Background workers have no request — establish the RLS tenant context from the event.
        setRlsContext({ organizationId, userId });

        // Inngest workers have no request session, so call the session-less core
        // directly with the org/user carried on the event (verified when enqueued).
        // Local adapter keeps the positional call sites below unchanged.
        const generateResource = (
            sourceId: string,
            sourceType: "TOPIC",
            resourceKindId: string,
            instructions: string,
            additionalData: { topicText?: string },
        ) =>
            generateResourceCore({
                organizationId,
                userId,
                sourceId,
                sourceType,
                resourceKindId,
                instructions,
                additionalData,
            });

        // 1. Fetch Spec & Bundle (both org-scoped — stamp tenant explicitly; grouped for consistency).
        const { spec, bundle } = await step.run("fetch-context", async () => {
            const { s, b } = await withTenant(
                async (tx) => {
                    const s = await tx.curriculumSpec.findUnique({ where: { id: specId } });
                    const b = await tx.curriculumBundle.findUnique({ where: { id: bundleId } });
                    return { s, b };
                },
                undefined,
                { organizationId, userId },
            );
            if (!s || !b) throw new NonRetriableError("Spec or Bundle not found");
            return { spec: s, bundle: b };
        });

        // 2. Generate Teacher Guide (TG) - The Source of Truth
        const tgResource = await step.run("generate-teacher-guide", async () => {
            // Find or create "Teacher Guide" ResourceKind
            const kind = await db.resourceKind.findFirst({ where: { code: "teacher_guide" } });
            if (!kind) throw new NonRetriableError("Teacher Guide ResourceKind not found (code: teacher_guide)");

            // Construct Prompt
            let prompt = `Strictly follow the spec: Grade ${spec.readingLevel}, ${spec.durationDays} Days. Constraints: ${JSON.stringify(spec.constraints)}.`;
            if (bundle.feedback) {
                prompt += `\n\nCRITICAL: This is a refinement of a previous version. User Defect Report: "${bundle.feedback}". You MUST fix this issue in the new output.`;
            }

            // Generate using standard action, but passing Spec context
            const result = await generateResource(
                specId, // Use Spec ID
                "TOPIC", // Fallback to TOPIC for now since SPEC isn't in SourceType enum yet
                kind.id,
                prompt,
                {
                    topicText: `Unit: ${spec.subject} - ${spec.topic} ${bundle.feedback ? '(Refined)' : ''}`,
                }
            );

            // Link to Bundle (org-scoped write — stamp the explicit tenant).
            if (result.success && result.resourceId) {
                await withTenant(
                    (tx) => tx.resource.update({
                        where: { id: result.resourceId },
                        data: { curriculumBundleId: bundleId }
                    }),
                    undefined,
                    { organizationId, userId },
                );
                return { id: result.resourceId };
            }
            throw new Error("Failed to generate TG");
        });

        // 3. Generate Student Packet (SP) - Derived from TG
        const spResource = await step.run("generate-student-packet", async () => {
            const kind = await db.resourceKind.findFirst({ where: { code: "student_packet" } });
            if (!kind) throw new NonRetriableError("Student Packet ResourceKind not found");

            let prompt = `Create student materials based on the Teacher Guide. Adhere to constraints: ${JSON.stringify(spec.constraints)}.`;
            if (bundle.feedback) {
                prompt += `\n\nRefinement Instruction: The user reported issues with the previous version: "${bundle.feedback}". Ensure the student materials reflect this fix.`;
            }

            const result = await generateResource(
                specId,
                "TOPIC",
                kind.id,
                prompt,
                {
                    topicText: `Student Packet for: ${spec.subject} - ${spec.topic} ${bundle.feedback ? '(Refined)' : ''}`
                }
            );

            if (result.success && result.resourceId) {
                await withTenant(
                    (tx) => tx.resource.update({
                        where: { id: result.resourceId },
                        data: { curriculumBundleId: bundleId }
                    }),
                    undefined,
                    { organizationId, userId },
                );
                return { id: result.resourceId };
            }
            throw new Error("Failed to generate SP");
        });

        // 4. Generate Slides (SL) - Visuals derived from TG
        await step.run("generate-slides", async () => {
            const kind = await db.resourceKind.findFirst({ where: { code: "slides" } });
            // If SLIDES kind doesn't exist, we might skip or fail. For now, we'll try to find it or fallback.
            if (!kind) return;

            let prompt = `Create a slide deck outline based on the Teacher Guide. Focus on visual and interactive elements. Constraints: ${JSON.stringify(spec.constraints)}.`;
            if (bundle.feedback) {
                prompt += `\n\nRefinement Instruction: User Defect: "${bundle.feedback}". Adjust visuals accordingly.`;
            }

            const result = await generateResource(
                specId,
                "TOPIC",
                kind.id,
                prompt,
                {
                    topicText: `Slides for: ${spec.subject} - ${spec.topic} ${bundle.feedback ? '(Refined)' : ''}`
                }
            );

            if (result.success && result.resourceId) {
                await withTenant(
                    (tx) => tx.resource.update({
                        where: { id: result.resourceId },
                        data: { curriculumBundleId: bundleId }
                    }),
                    undefined,
                    { organizationId, userId },
                );
            }
        });

        // 5. Generate Reading Anthology (RA) - All texts in one place
        const raResource = await step.run("generate-reading-anthology", async () => {
            // specific kind or fallback to ARTICLE
            let kind = await db.resourceKind.findFirst({ where: { code: "reading_anthology" } });
            if (!kind) kind = await db.resourceKind.findFirst({ where: { code: "article" } });
            if (!kind) return null;

            let prompt = `Create a Reading Anthology for the Student Packet. Extract and compile all reading passages, primary sources, and poems mentioned in the Teacher Guide. Constraints: ${JSON.stringify(spec.constraints)}.`;
            if (bundle.feedback) {
                prompt += `\n\nRefinement Instruction: User Defect: "${bundle.feedback}". Ensure text selections address this.`;
            }

            const result = await generateResource(
                specId,
                "TOPIC",
                kind.id,
                prompt,
                {
                    topicText: `Reading Anthology: ${spec.subject} - ${spec.topic} ${bundle.feedback ? '(Refined)' : ''}`
                }
            );

            if (result.success && result.resourceId) {
                await withTenant(
                    (tx) => tx.resource.update({
                        where: { id: result.resourceId },
                        data: { curriculumBundleId: bundleId, title: "Reading Anthology" }
                    }),
                    undefined,
                    { organizationId, userId },
                );
                return { id: result.resourceId };
            }
            return null;
        });

        // 6. Generate Organizers (CO) - Charts & Graphic Organizers
        const coResource = await step.run("generate-organizers", async () => {
            let kind = await db.resourceKind.findFirst({ where: { code: "graphic_organizers" } });
            if (!kind) kind = await db.resourceKind.findFirst({ where: { code: "worksheet" } });
            if (!kind) return null;

            let prompt = `Create a set of blank Graphic Organizers and Charts needed for the lessons in the Teacher Guide. Constraints: ${JSON.stringify(spec.constraints)}.`;
            if (bundle.feedback) {
                prompt += `\n\nRefinement Instruction: User Defect: "${bundle.feedback}". Adjust layouts accordingly.`;
            }

            const result = await generateResource(
                specId,
                "TOPIC",
                kind.id,
                prompt,
                {
                    topicText: `Graphic Organizers: ${spec.subject} - ${spec.topic} ${bundle.feedback ? '(Refined)' : ''}`
                }
            );

            if (result.success && result.resourceId) {
                await withTenant(
                    (tx) => tx.resource.update({
                        where: { id: result.resourceId },
                        data: { curriculumBundleId: bundleId, title: "Charts & Organizers" }
                    }),
                    undefined,
                    { organizationId, userId },
                );
                return { id: result.resourceId };
            }
            return null;
        });

        // 7. Verification Gate
        // A real preflight check: hash every artifact for integrity, read the ACTUAL
        // generated content, have the model judge it against the spec, persist a
        // computed Release Manifest, and return a gate decision finalize must honor.
        const verification = await step.run("run-verification-gate", async () => {
            const manifestKind = await db.resourceKind.findFirst({ where: { code: "release_manifest" } });

            // Pull every generated artifact (excluding any prior manifest) with its real content.
            // resources is org-scoped — stamp the explicit tenant or the read returns empty.
            const artifacts = await withTenant(
                (tx) => tx.resource.findMany({
                    where: {
                        curriculumBundleId: bundleId,
                        resourceKind: { code: { not: "release_manifest" } },
                    },
                    select: {
                        id: true,
                        storageType: true,
                        content: true,
                        resourceKind: { select: { code: true, label: true } },
                    },
                }),
                undefined,
                { organizationId, userId },
            );

            // Real integrity: SHA-256 over each artifact's actual content + its byte size.
            const artifactReport = artifacts.map((a) => {
                const text = extractContentText(a.storageType, a.content);
                return {
                    type: a.resourceKind.label,
                    code: a.resourceKind.code,
                    resourceId: a.id,
                    storageType: a.storageType,
                    bytes: Buffer.byteLength(text, "utf8"),
                    sha256: text ? sha256(text) : null,
                };
            });

            const byCode = (code: string) => artifacts.find((a) => a.resourceKind.code === code);
            const tg = byCode("teacher_guide");
            const sp = byCode("student_packet");
            const tgText = tg ? extractContentText(tg.storageType, tg.content) : "";
            const spText = sp ? extractContentText(sp.storageType, sp.content) : "";

            // Structural gate: the core artifacts must exist AND be non-trivial.
            const MIN_CHARS = 200;
            const structural = {
                teacherGuidePresent: tgText.length >= MIN_CHARS,
                studentPacketPresent: spText.length >= MIN_CHARS,
            };

            // Qualitative gate: judge the REAL content against the spec. Fault-tolerant —
            // if the model call fails, qualitative QA is marked unavailable and does NOT block.
            let qa: Record<string, unknown>;
            let qaBlocking = false;
            try {
                const { object } = await generateObject({
                    model: models.pro3,
                    schema: VerificationVerdictSchema,
                    system:
                        "You are a meticulous curriculum QA reviewer. Judge ONLY the provided artifact content against the spec. " +
                        "Set releaseRecommended=false ONLY for a severe, clearly release-blocking problem (off-topic content, " +
                        "wildly wrong reading level, or a violated hard constraint). Minor or stylistic issues must NOT block release.",
                    prompt:
                        `SPEC\n` +
                        `Subject: ${spec.subject}\nTopic: ${spec.topic}\nReading level: ${spec.readingLevel}\n` +
                        `Duration (days): ${spec.durationDays}\nConstraints: ${JSON.stringify(spec.constraints)}\n\n` +
                        `ARTIFACTS PRESENT: ${artifacts.map((a) => a.resourceKind.label).join(", ") || "none"}\n\n` +
                        `--- TEACHER GUIDE (truncated) ---\n${tgText.slice(0, 8000) || "[MISSING]"}\n\n` +
                        `--- STUDENT PACKET (truncated) ---\n${spText.slice(0, 6000) || "[MISSING]"}\n\n` +
                        `Evaluate: reading-level fit, whether the Teacher Guide plausibly covers ${spec.durationDays} day(s), ` +
                        `grayscale safety (no reliance on color alone), adherence to the constraints, and overall release readiness.`,
                });
                qa = object;
                qaBlocking = object.releaseRecommended === false;
            } catch (err) {
                qa = { unavailable: true, error: err instanceof Error ? err.message : String(err) };
            }

            const blockingReasons: string[] = [];
            if (!structural.teacherGuidePresent) blockingReasons.push("Teacher Guide missing or empty");
            if (!structural.studentPacketPresent) blockingReasons.push("Student Packet missing or empty");
            if (qaBlocking) blockingReasons.push(typeof qa.summary === "string" ? qa.summary : "Failed qualitative QA review");

            const gatePassed = blockingReasons.length === 0;

            const manifest = {
                schemaVersion: 1,
                buildId: bundleId,
                generatedAt: new Date().toISOString(),
                spec: {
                    subject: spec.subject,
                    topic: spec.topic,
                    readingLevel: spec.readingLevel,
                    durationDays: spec.durationDays,
                    constraints: spec.constraints,
                },
                artifacts: artifactReport,
                checks: { ...structural, structuralPassed: structural.teacherGuidePresent && structural.studentPacketPresent },
                qa,
                gate: { result: gatePassed ? "PASS" : "FAIL", blockingReasons },
            };

            // Persist the computed manifest as the release_manifest resource (org-scoped write).
            if (manifestKind) {
                await withTenant(
                    (tx) => tx.resource.create({
                        data: {
                            organizationId,
                            createdByUserId: userId,
                            resourceKindId: manifestKind.id,
                            title: "Release Manifest & QA Report",
                            description: `Verification gate: ${gatePassed ? "PASS" : "FAIL"}`,
                            storageType: "JSON",
                            content: manifest as object,
                            curriculumBundleId: bundleId,
                        },
                    }),
                    undefined,
                    { organizationId, userId },
                );
            }

            const summary = gatePassed
                ? (typeof qa.summary === "string" ? qa.summary : "All checks passed.")
                : blockingReasons.join("; ");
            return { gatePassed, summary };
        });

        // 8. Finalize Bundle — honor the gate decision (org-scoped write).
        await step.run("finalize-bundle", async () => {
            await withTenant(
                (tx) => tx.curriculumBundle.update({
                    where: { id: bundleId },
                    data: verification.gatePassed
                        ? { status: "COMPLETED", failureReason: null }
                        : { status: "FAILED", failureReason: `Verification gate failed: ${verification.summary}`.slice(0, 1000) },
                }),
                undefined,
                { organizationId, userId },
            );
        });

        return { success: true, bundleId, verified: verification.gatePassed };
    }
);

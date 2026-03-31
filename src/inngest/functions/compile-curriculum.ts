import { inngest } from "@/inngest/client";
import { db } from "@/server/db";
import { generateResource } from "@/app/actions/generate-resource";
import { NonRetriableError } from "inngest";

export const compileCurriculum = inngest.createFunction(
    { id: "compile-curriculum" },
    { event: "curriculum/compile" },
    async ({ event, step, logger }) => {
        const { bundleId, specId, organizationId, userId } = event.data;

        // 1. Fetch Spec & Bundle
        const { spec, bundle } = await step.run("fetch-context", async () => {
            const s = await db.curriculumSpec.findUnique({ where: { id: specId } });
            const b = await db.curriculumBundle.findUnique({ where: { id: bundleId } });
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

            // Link to Bundle
            if (result.success && result.resourceId) {
                await db.resource.update({
                    where: { id: result.resourceId },
                    data: { curriculumBundleId: bundleId }
                });
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
                await db.resource.update({
                    where: { id: result.resourceId },
                    data: { curriculumBundleId: bundleId }
                });
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
                await db.resource.update({
                    where: { id: result.resourceId },
                    data: { curriculumBundleId: bundleId }
                });
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
                await db.resource.update({
                    where: { id: result.resourceId },
                    data: { curriculumBundleId: bundleId, title: "Reading Anthology" }
                });
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
                await db.resource.update({
                    where: { id: result.resourceId },
                    data: { curriculumBundleId: bundleId, title: "Charts & Organizers" }
                });
                return { id: result.resourceId };
            }
            return null;
        });

        // 7. Verification Gate (Studio 26 Validation)
        await step.run("run-verification-gate", async () => {
            // This simulates the "Preflight Check"
            // In a full implementation, we would read the TG and SP content and use an LLM to compare them.
            // For this MVP, we will generate a "Manifest" resource that acts as the proof.

            const kind = await db.resourceKind.findFirst({ where: { code: "article" } }); // Using ARTICLE for the report/manifest
            if (!kind) return;

            const manifestData = {
                buildId: bundleId,
                timestamp: new Date().toISOString(),
                spec: {
                    subject: spec.subject,
                    topic: spec.topic,
                    level: spec.readingLevel,
                    constraints: spec.constraints
                },
                artifacts: [
                    { type: "Teacher Guide", id: tgResource.id, integrity: "SHA256-PENDING" },
                    { type: "Student Packet", id: spResource?.id, integrity: "SHA256-PENDING" },
                    { type: "Reading Anthology", id: raResource?.id, integrity: "SHA256-PENDING" },
                    { type: "Organizers", id: coResource?.id, integrity: "SHA256-PENDING" }
                ],
                defects: [] // Placeholder for defect log
            };

            const verificationPrompt = `
                Perform a QA check on the generated ${spec.subject} curriculum.
                1. Verify that the Student Packet adheres to the constraint: ${spec.constraints ? JSON.stringify(spec.constraints) : 'None'}.
                2. Confirm that the Teacher Guide covers ${spec.durationDays} days.
                3. GRAYSCALE COMPATIBILITY CHECK: Analyze the Slides and Organizers. Do they rely on color for meaning? If so, flag as a defect.
                4. Return the following JSON manifest with your QA notes added to the 'defects' array if any issues found:
                ${JSON.stringify(manifestData, null, 2)}
             `;

            const result = await generateResource(
                specId,
                "TOPIC",
                kind.id,
                verificationPrompt,
                {
                    topicText: `RELEASE MANIFEST: ${spec.subject} - ${spec.topic}`
                }
            );

            if (result.success && result.resourceId) {
                await db.resource.update({
                    where: { id: result.resourceId },
                    data: {
                        curriculumBundleId: bundleId,
                        title: "Release Manifest & QA Report"
                    }
                });
            }
        });

        // 6. Finalize Bundle
        await step.run("finalize-bundle", async () => {
            await db.curriculumBundle.update({
                where: { id: bundleId },
                data: { status: "COMPLETED" }
            });
        });

        return { success: true, bundleId };
    }
);

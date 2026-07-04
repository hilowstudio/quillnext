import { Learner, Classroom } from "@/generated/client";
import { INKLING_BASE_PERSONALITY, INKLING_ETHICAL_GUIDELINES } from "@/lib/constants/ai-guardrails";
import { PHILOSOPHY_PROMPTS } from "@/lib/constants/educational-philosophies";
import { CONSTITUTION } from "@/lib/constants/constitution";
import { composeFaithFrame } from "@/lib/constants/faith-traditions";
import { gradeBandLabel, difficultyLabel } from "@/lib/constants/grade-bands";

/** General-audience target when generation is NOT personalized to a specific student. */
export interface GenerationAudience {
    gradeBand?: string;
    difficulty?: string;
}

export class PromptBuilder {
    private identity: string = INKLING_BASE_PERSONALITY;
    private ethicalGuardrails: string = INKLING_ETHICAL_GUIDELINES;
    private studentContext: string = "";
    private familyContext: string = "";
    private taskDescription: string = "";
    private sourceContent: string = "";
    private userInstructions: string = "";
    private pedagogicalFramework: string = "";
    // The worldview constitution + this family's faith frame. Defaults to the constitution alone
    // (always on); setFamilyContext refines it with the family's tradition block.
    private faithFrame: string = CONSTITUTION;

    constructor() { }

    setIdentity(identity?: string) {
        if (identity) this.identity = identity;
        return this;
    }

    getIdentity() {
        return this.identity;
    }

    /**
     * Sets the student context, transforming "Learning Difficulties" into
     * "Helpful Supports & Accommodations".
     */
    setStudentContext(student: Learner | null, audience?: GenerationAudience | null) {
        if (!student) {
            // General-audience mode: write for a manually-specified grade band + difficulty, not a
            // named child. This is the non-personalized happy path (e.g. a resource for any 5th grader,
            // or an adult class) — generation must never require a student.
            const band = audience?.gradeBand ? gradeBandLabel(audience.gradeBand) : null;
            if (band) {
                const diff = audience?.difficulty ? difficultyLabel(audience.difficulty) : null;
                this.studentContext = `Target Audience (general — no specific student):
- Level: ${band}${diff ? ` (${diff})` : ""}
- Write for this audience generally; do not address or assume a named child.`;
            } else {
                this.studentContext = "Student: Generic Profile (Age/Grade not specified)";
            }
            return this;
        }

        const age = student.birthdate
            ? `${new Date().getFullYear() - student.birthdate.getFullYear()} years old`
            : "Age not specified";

        // Combine legacy and new support fields
        const supports = [
            ...(student.support_labels || []),
            ...(student.learningDifficulties ? student.learningDifficulties.split(",").map(s => s.trim()) : [])
        ].filter(Boolean);

        // Deduplicate
        const uniqueSupports = Array.from(new Set(supports));

        const supportString = uniqueSupports.length > 0
            ? `Helpful Supports & Accommodations: ${uniqueSupports.join(", ")}`
            : "Standard approach (no specific supports listed)";

        this.studentContext = `Student Profile:
- Name: ${student.preferredName || student.firstName}
- Grade: ${student.currentGrade} (${age})
- ${supportString}`;

        return this;
    }

    /**
     * Inject a pre-rendered, rich student block (the shared `serializeStudentContext` output:
     * personality / learning style / interests). Overrides the thin `setStudentContext` rendering
     * so the assessment actually reaches the model. Used when a specific student is targeted.
     */
    setStudentBlock(block: string) {
        this.studentContext = block;
        return this;
    }

    /**
     * Sets the Family/Classroom context, specifically the Educational Philosophy.
     */
    setFamilyContext(classroom: Classroom | null) {
        // The worldview constitution (always) + this family's full profile (tradition, confessions,
        // conviction flags). Supersedes the old one-line "integrate an X worldview" nudge.
        this.faithFrame = composeFaithFrame(classroom ?? {});

        if (!classroom) {
            this.familyContext = "Family Context: General Homeschooling";
            // Default purely to Eclectic if no classroom
            this.pedagogicalFramework = PHILOSOPHY_PROMPTS["ECLECTIC"];
            return this;
        }

        const philosophy = classroom.educationalPhilosophy || "ECLECTIC";
        const faith = classroom.faithBackground || "OTHER";

        // Include the family's own goals/challenges/description — captured in onboarding but previously
        // dropped from this (main-generator) path; they only reached the grading/suggest serializer.
        const parts = [
            "Family Context:",
            `- Educational Philosophy: ${philosophy}`,
            `- Faith Background: ${faith}`,
        ];
        if (classroom.description) parts.push(`- Description: ${classroom.description}`);
        if (classroom.academicGoals?.length) parts.push(`- Educational Goals: ${classroom.academicGoals.join(", ")}`);
        if (classroom.challenges?.length) parts.push(`- Current Challenges: ${classroom.challenges.join(", ")}`);
        this.familyContext = parts.join("\n");

        // Set the pedagogical framework instructions
        this.pedagogicalFramework = PHILOSOPHY_PROMPTS[philosophy] || PHILOSOPHY_PROMPTS["ECLECTIC"];

        return this;
    }

    setTask(task: string, subContext?: string) {
        this.taskDescription = `Task: ${task}\nContext: ${subContext || "N/A"}`;
        return this;
    }

    setSourceContent(content: string) {
        this.sourceContent = content;
        return this;
    }

    setUserInstructions(instructions: string) {
        this.userInstructions = instructions;
        return this;
    }

    build(): string {
        return `
${this.identity}

${this.ethicalGuardrails}

${this.faithFrame}

=============================================
CONTEXT & INPUT DATA
=============================================

${this.studentContext}

${this.familyContext}

${this.taskDescription}

Source Content:
${this.sourceContent}

User Instructions:
${this.userInstructions || "No specific additional instructions."}

=============================================
PEDAGOGICAL FRAMEWORK & REQUIREMENTS
=============================================

${this.pedagogicalFramework}

=============================================
OUTPUT GUIDELINES
=============================================
- **Tone**: Professional, encouraging, and academically rigorous yet accessible.
- **Format**: Use valid Markdown. Use headers, bolding, and bullet points effectively.
- **Visuals**: If the resource is a "Wheel", "Map", "Chart", or "Diagram", describe the visual layout clearly in text or use Markdown tables/Mermaid diagrams.
- **Labeling**: ALWAYS label the output as a draft for parental review.
`;
    }
}

import { EducationalPhilosophy, Learner, Classroom } from "@/generated/client";
import { INKLING_BASE_PERSONALITY, INKLING_ETHICAL_GUIDELINES } from "@/lib/constants/ai-guardrails";
import { PHILOSOPHY_PROMPTS } from "@/lib/constants/educational-philosophies";

export class PromptBuilder {
    private identity: string = INKLING_BASE_PERSONALITY;
    private ethicalGuardrails: string = INKLING_ETHICAL_GUIDELINES;
    private studentContext: string = "";
    private familyContext: string = "";
    private taskDescription: string = "";
    private sourceContent: string = "";
    private userInstructions: string = "";
    private pedagogicalFramework: string = "";

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
    setStudentContext(student: Learner | null) {
        if (!student) {
            this.studentContext = "Student: Generic Profile (Age/Grade not specified)";
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
     * Sets the Family/Classroom context, specifically the Educational Philosophy.
     */
    setFamilyContext(classroom: Classroom | null) {
        if (!classroom) {
            this.familyContext = "Family Context: General Homeschooling";
            // Default purely to Eclectic if no classroom
            this.pedagogicalFramework = PHILOSOPHY_PROMPTS["ECLECTIC"];
            return this;
        }

        const philosophy = classroom.educationalPhilosophy || "ECLECTIC";
        const faith = classroom.faithBackground || "OTHER";

        this.familyContext = `Family Context:
- Educational Philosophy: ${philosophy}
- Faith Background: ${faith}`;

        // Set the pedagogical framework instructions
        this.pedagogicalFramework = PHILOSOPHY_PROMPTS[philosophy] || PHILOSOPHY_PROMPTS["ECLECTIC"];

        // Append faith integration if applicable
        if (faith !== "OTHER" && faith !== "NONDENOMINATIONAL") {
            this.pedagogicalFramework += `\n\nFaith Integration:\nIntegrate a ${faith.replace(/_/g, " ")} worldview naturally where appropriate.`;
        }

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

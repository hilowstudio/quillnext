import { describe, it, expect } from "vitest";
import { PromptBuilder } from "./prompt-builder";

// Generation Target: a general audience (grade band + difficulty) personalizes output when there is
// no specific student, and generation must never require a student.
describe("PromptBuilder.setStudentContext — Generation Target", () => {
  it("renders a general-audience target when no student but an audience is given", () => {
    const prompt = new PromptBuilder()
      .setStudentContext(null, { gradeBand: "MIDDLE", difficulty: "ABOVE" })
      .build();
    expect(prompt).toContain("Target Audience (general");
    expect(prompt).toContain("Middle School (6–8)");
    expect(prompt).toContain("above grade level");
    expect(prompt).not.toContain("Generic Profile");
  });

  it("omits the difficulty parenthetical when only a band is given", () => {
    const prompt = new PromptBuilder()
      .setStudentContext(null, { gradeBand: "EARLY_ELEMENTARY" })
      .build();
    expect(prompt).toContain("Early Elementary (K–2)");
    expect(prompt).not.toContain("(at grade level)");
  });

  it("falls back to a generic profile when neither student nor audience is given", () => {
    const prompt = new PromptBuilder().setStudentContext(null, null).build();
    expect(prompt).toContain("Generic Profile");
  });

  it("setStudentBlock injects a pre-rendered rich block verbatim", () => {
    const block = "STUDENT CONTEXT:\n- Name: Ada\nPERSONALITY & MOTIVATION:\n- Motivational Driver: The Win";
    const prompt = new PromptBuilder().setStudentBlock(block).build();
    expect(prompt).toContain("PERSONALITY & MOTIVATION:");
    expect(prompt).toContain("The Win");
  });

  it("setArtifactGuidance adds a build-guidance section only when set", () => {
    const withGuidance = new PromptBuilder().setArtifactGuidance("Include an answer key.").build();
    expect(withGuidance).toContain("BUILDING THIS ARTIFACT WELL");
    expect(withGuidance).toContain("Include an answer key.");
    expect(new PromptBuilder().build()).not.toContain("BUILDING THIS ARTIFACT WELL");
  });

  it("setFamilyContext renders the family's goals, challenges, and description", () => {
    const classroom = {
      educationalPhilosophy: "CLASSICAL",
      faithBackground: "BAPTIST",
      description: "A relaxed morning-time family.",
      academicGoals: ["Strong writing", "Critical thinking"],
      challenges: ["Multiple ages"],
    } as unknown as Parameters<PromptBuilder["setFamilyContext"]>[0];
    const prompt = new PromptBuilder().setFamilyContext(classroom).build();
    expect(prompt).toContain("Educational Goals: Strong writing, Critical thinking");
    expect(prompt).toContain("Current Challenges: Multiple ages");
    expect(prompt).toContain("A relaxed morning-time family.");
  });

  it("uses the student's own profile when a student is given (audience ignored)", () => {
    const student = {
      firstName: "Ada",
      preferredName: null,
      currentGrade: "5th Grade",
      birthdate: null,
      support_labels: [],
      learningDifficulties: null,
    } as unknown as Parameters<PromptBuilder["setStudentContext"]>[0];
    const prompt = new PromptBuilder()
      .setStudentContext(student, { gradeBand: "ADULT" })
      .build();
    expect(prompt).toContain("Ada");
    expect(prompt).toContain("5th Grade");
    expect(prompt).not.toContain("Adult / General");
  });
});

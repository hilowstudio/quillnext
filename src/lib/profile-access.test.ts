import { describe, it, expect } from "vitest";
import { isSelectProfilePath, isStudentAllowed, profileGateDecision } from "./profile-access";

describe("isSelectProfilePath", () => {
  it("matches the picker route and its subpaths only", () => {
    expect(isSelectProfilePath("/select-profile")).toBe(true);
    expect(isSelectProfilePath("/select-profile/anything")).toBe(true);
    expect(isSelectProfilePath("/select-profile-foo")).toBe(false);
    expect(isSelectProfilePath("/")).toBe(false);
  });
});

describe("isStudentAllowed", () => {
  it("allows the learner surfaces", () => {
    for (const p of [
      "/",
      "/select-profile",
      "/courses/abc123/learn",
      "/living-library/resource/xyz",
      "/family-discipleship",
      "/family-discipleship/prayer",
      "/students/s1/family-discipleship",
      "/students/s1/family-discipleship/catechism",
    ]) {
      expect(isStudentAllowed(p), p).toBe(true);
    }
  });

  it("blocks admin / non-learner surfaces", () => {
    for (const p of [
      "/courses",
      "/courses/abc123",
      "/courses/abc123/builder",
      "/courses/abc123/blocks/b1",
      "/living-library",
      "/living-library/videos",
      "/students",
      "/students/s1",
      "/students/s1/assessment",
      "/context",
      "/planner",
      "/grading",
      "/creation-station",
      "/blueprint",
      "/onboarding",
    ]) {
      expect(isStudentAllowed(p), p).toBe(false);
    }
  });
});

describe("profileGateDecision", () => {
  it("PARENT may go anywhere", () => {
    expect(profileGateDecision("/courses", "PARENT")).toBe("allow");
    expect(profileGateDecision("/anything/at/all", "PARENT")).toBe("allow");
  });

  it("STUDENT is held to the learner allowlist", () => {
    expect(profileGateDecision("/", "STUDENT")).toBe("allow");
    expect(profileGateDecision("/family-discipleship/prayer", "STUDENT")).toBe("allow");
    expect(profileGateDecision("/courses/c1/builder", "STUDENT")).toBe("picker");
    expect(profileGateDecision("/students/s1", "STUDENT")).toBe("picker");
  });

  it("no active profile may reach only the picker", () => {
    expect(profileGateDecision("/select-profile", null)).toBe("allow");
    expect(profileGateDecision("/", null)).toBe("picker");
    expect(profileGateDecision("/courses", null)).toBe("picker");
  });
});

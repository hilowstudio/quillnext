import { describe, it, expect } from "vitest";
import {
  isOnboardingPath,
  isSelectProfilePath,
  isStudentAllowed,
  profileGateDecision,
} from "./profile-access";

describe("isSelectProfilePath", () => {
  it("matches the picker route and its subpaths only", () => {
    expect(isSelectProfilePath("/select-profile")).toBe(true);
    expect(isSelectProfilePath("/select-profile/anything")).toBe(true);
    expect(isSelectProfilePath("/select-profile-foo")).toBe(false);
    expect(isSelectProfilePath("/")).toBe(false);
  });
});

describe("isOnboardingPath", () => {
  it("matches the onboarding route and its subpaths only", () => {
    expect(isOnboardingPath("/onboarding")).toBe(true);
    expect(isOnboardingPath("/onboarding/step-2")).toBe(true);
    expect(isOnboardingPath("/onboarding-foo")).toBe(false);
    expect(isOnboardingPath("/")).toBe(false);
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

  it("no active profile may reach the picker or onboarding (the two pre-profile surfaces)", () => {
    expect(profileGateDecision("/select-profile", null)).toBe("allow");
    expect(profileGateDecision("/", null)).toBe("picker");
    expect(profileGateDecision("/courses", null)).toBe("picker");
  });

  // Regression: a brand-new user has no org and no profile. The proxy gate must let them reach
  // /onboarding, otherwise /select-profile (which redirects a null-org user to /onboarding) and the
  // proxy (which bounced /onboarding back to /select-profile) form an infinite redirect loop.
  it("lets a not-yet-onboarded user (no active profile) reach /onboarding", () => {
    expect(profileGateDecision("/onboarding", null)).toBe("allow");
    expect(profileGateDecision("/onboarding/step-2", null)).toBe("allow");
  });

  it("still holds a STUDENT out of onboarding", () => {
    expect(profileGateDecision("/onboarding", "STUDENT")).toBe("picker");
  });
});

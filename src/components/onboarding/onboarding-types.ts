import type { getBlueprintProgress } from "@/server/actions/blueprint";

// The blueprint/classroom payload the onboarding page loads (getBlueprintProgress.data) and threads
// to every wizard step: a Classroom with its instructors + holidays, or null on a fresh org.
export type OnboardingData = Awaited<ReturnType<typeof getBlueprintProgress>>["data"];

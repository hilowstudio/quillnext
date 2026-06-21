import { describe, it, expect, vi } from "vitest";

// Replace the DB + email deps so importing safety-alert.ts is hermetic (no server-only, no Resend).
vi.mock("@/server/db", () => ({ withTenant: vi.fn() }));
vi.mock("resend", () => ({ Resend: vi.fn() }));

import { isAlertDeliverable } from "./safety-alert";

/**
 * Shape-lock for the delivery-layer hard-stop (T1-E). A caregiver email may be sent ONLY for an
 * explicit PARENT_SUMMARY_* resolution AND only when the caregiver is not the implicated threat.
 * This is defense-in-depth: even if a caller bug passes a non-parent-summary resolution or a
 * hard-stop flag, sendSafetyAlert must refuse to email. These tests fail if the predicate is
 * loosened (e.g. starts sending for STUDENT_OPTIONAL_OUTREACH or ignores implicatedCaregiver).
 */
describe("isAlertDeliverable (T1-E delivery-layer hard-stop)", () => {
    it("allows PARENT_SUMMARY_URGENT with no implicated caregiver", () => {
        expect(isAlertDeliverable({ resolution: "PARENT_SUMMARY_URGENT", implicatedCaregiver: false })).toBe(true);
    });

    it("allows PARENT_SUMMARY_SAFETY_COACH with no implicated caregiver", () => {
        expect(isAlertDeliverable({ resolution: "PARENT_SUMMARY_SAFETY_COACH", implicatedCaregiver: false })).toBe(
            true,
        );
    });

    it("refuses when the caregiver is implicated, even for an URGENT resolution", () => {
        expect(isAlertDeliverable({ resolution: "PARENT_SUMMARY_URGENT", implicatedCaregiver: true })).toBe(false);
    });

    it("refuses non-parent-summary resolutions", () => {
        expect(isAlertDeliverable({ resolution: "STUDENT_OPTIONAL_OUTREACH", implicatedCaregiver: false })).toBe(false);
        expect(isAlertDeliverable({ resolution: "SUPPORTIVE_ONLY", implicatedCaregiver: false })).toBe(false);
        expect(isAlertDeliverable({ resolution: "INTERNAL_LOG_ONLY", implicatedCaregiver: false })).toBe(false);
        expect(isAlertDeliverable({ resolution: "NO_ACTION", implicatedCaregiver: false })).toBe(false);
    });

    it("refuses a null resolution", () => {
        expect(isAlertDeliverable({ resolution: null, implicatedCaregiver: false })).toBe(false);
    });
});

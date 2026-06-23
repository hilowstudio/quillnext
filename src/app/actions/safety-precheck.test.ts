import { describe, it, expect, vi, beforeEach } from "vitest";

// Hermetic: mock auth + the AI SDK deps that guard.ts pulls in at module load.
vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("ai", () => ({ generateObject: vi.fn() }));
vi.mock("@/lib/ai/config", () => ({ models: { flashLite: {} } }));

import { auth } from "@/auth";
import { precheckMessageSafety } from "./safety-precheck";

/**
 * Shape-lock for the synchronous in-the-moment pre-check (Q-12-007). Runs the pure regex fast-path and
 * returns ONLY whether a concern was found + its category (never patterns or stored data) so the chat UI
 * can surface the crisis-resources affordance immediately. Fails closed to "no concern" when unauthed or
 * on bad input; never throws into the chat path.
 */
describe("precheckMessageSafety (Q-12-007)", () => {
    beforeEach(() => {
        vi.mocked(auth).mockResolvedValue({ user: { id: "u1" } } as never);
    });

    it("flags a regex-detected self-harm message with its category", async () => {
        const r = await precheckMessageSafety("I want to kill myself");
        expect(r).toEqual({ concern: true, category: "SELF_HARM" });
    });

    it("returns no concern for a benign message", async () => {
        expect(await precheckMessageSafety("can you help me with long division")).toEqual({ concern: false });
    });

    it("returns no concern when unauthenticated", async () => {
        vi.mocked(auth).mockResolvedValueOnce(null as never);
        expect(await precheckMessageSafety("I want to kill myself")).toEqual({ concern: false });
    });

    it("returns no concern for empty/blank input", async () => {
        expect(await precheckMessageSafety("   ")).toEqual({ concern: false });
    });
});

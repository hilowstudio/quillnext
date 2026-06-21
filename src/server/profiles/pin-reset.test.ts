import { describe, it, expect, vi, beforeEach } from "vitest";

const authMock = vi.fn();
const getCurrentUserOrg = vi.fn();
const withTenant = vi.fn();
const sendMock = vi.fn();
const verifyPinWithThrottle = vi.fn();
const headerMap: Record<string, string | undefined> = {};

vi.mock("@/auth", () => ({ auth: () => authMock() }));
vi.mock("@/lib/auth-helpers", () => ({ getCurrentUserOrg: (...a: unknown[]) => getCurrentUserOrg(...a) }));
vi.mock("@/server/db", () => ({ withTenant: (...a: unknown[]) => withTenant(...a) }));
vi.mock("@/server/profiles/pin-verify", () => ({
  verifyPinWithThrottle: (...a: unknown[]) => verifyPinWithThrottle(...a),
}));
vi.mock("next/headers", () => ({ headers: async () => ({ get: (k: string) => headerMap[k] ?? null }) }));
vi.mock("resend", () => ({
  Resend: class {
    emails = { send: (...a: unknown[]) => sendMock(...a) };
  },
}));

import { signPinResetToken } from "@/lib/profile-pin-reset-token";
import { requestOwnerPinReset, confirmOwnerPinReset, resetChildPinWithParentPin } from "./pin-reset";

const SECRET = "test-secret-0123456789-abcdefghij-KLMNOP";

beforeEach(() => {
  vi.clearAllMocks();
  process.env.AUTH_SECRET = SECRET;
  process.env.RESEND_API_KEY = "re_test";
  delete process.env.ACCOUNT_EMAIL_FROM;
  for (const k of Object.keys(headerMap)) delete headerMap[k];
  headerMap["host"] = "app.test";
  verifyPinWithThrottle.mockResolvedValue({ ok: true });
});

describe("requestOwnerPinReset", () => {
  it("emails the signed-in owner a reset link when the owner profile has a PIN", async () => {
    authMock.mockResolvedValue({ user: { id: "u1", email: "owner@example.com" } });
    getCurrentUserOrg.mockResolvedValue({ userId: "u1", organizationId: "o1" });
    withTenant.mockResolvedValue({ id: "p-owner", pinHash: "hash" });
    sendMock.mockResolvedValue({ error: undefined });

    const res = await requestOwnerPinReset();
    expect(res).toEqual({ ok: true });
    expect(sendMock).toHaveBeenCalledTimes(1);
    const arg = sendMock.mock.calls[0][0] as { to: string; subject: string; text: string };
    expect(arg.to).toBe("owner@example.com");
    expect(arg.text).toContain("/select-profile/reset-pin?token=");
  });

  it("reports success WITHOUT sending when there is no PIN to reset (no leak)", async () => {
    authMock.mockResolvedValue({ user: { id: "u1", email: "owner@example.com" } });
    getCurrentUserOrg.mockResolvedValue({ userId: "u1", organizationId: "o1" });
    withTenant.mockResolvedValue({ id: "p-owner", pinHash: null });

    const res = await requestOwnerPinReset();
    expect(res).toEqual({ ok: true });
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("fails loudly (no false success) when email is not configured", async () => {
    delete process.env.RESEND_API_KEY;
    authMock.mockResolvedValue({ user: { id: "u1", email: "owner@example.com" } });
    getCurrentUserOrg.mockResolvedValue({ userId: "u1", organizationId: "o1" });
    withTenant.mockResolvedValue({ id: "p-owner", pinHash: "hash" });

    const res = await requestOwnerPinReset();
    expect(res.ok).toBe(false);
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("requires a signed-in user with an email", async () => {
    authMock.mockResolvedValue(null);
    const res = await requestOwnerPinReset();
    expect(res.ok).toBe(false);
    expect(getCurrentUserOrg).not.toHaveBeenCalled();
  });
});

describe("confirmOwnerPinReset", () => {
  // The action verifies against the real Date.now(), so valid tokens must be signed at the current
  // clock (the fixed NOW above is for the deterministic-expiry tests in the token module's own suite).
  const freshToken = (claims: { uid: string; org: string; profileId: string }) =>
    signPinResetToken(claims, SECRET, Date.now());

  it("clears the owner PARENT PIN for a valid token bound to the same login + org", async () => {
    getCurrentUserOrg.mockResolvedValue({ userId: "u1", organizationId: "o1" });
    withTenant.mockResolvedValueOnce({ id: "p-owner" }).mockResolvedValueOnce(undefined);
    const token = await freshToken({ uid: "u1", org: "o1", profileId: "p-owner" });

    const res = await confirmOwnerPinReset(token);
    expect(res).toEqual({ ok: true });
    expect(withTenant).toHaveBeenCalledTimes(2); // owner lookup + clear update
  });

  it("rejects a token issued to a different login (uid mismatch) without writing", async () => {
    getCurrentUserOrg.mockResolvedValue({ userId: "uX", organizationId: "o1" });
    const token = await freshToken({ uid: "u1", org: "o1", profileId: "p-owner" });

    const res = await confirmOwnerPinReset(token);
    expect(res.ok).toBe(false);
    expect(withTenant).not.toHaveBeenCalled();
  });

  it("rejects a token issued under a different org without writing", async () => {
    getCurrentUserOrg.mockResolvedValue({ userId: "u1", organizationId: "oX" });
    const token = await freshToken({ uid: "u1", org: "o1", profileId: "p-owner" });

    const res = await confirmOwnerPinReset(token);
    expect(res.ok).toBe(false);
    expect(withTenant).not.toHaveBeenCalled();
  });

  it("rejects an invalid/garbage token without writing", async () => {
    getCurrentUserOrg.mockResolvedValue({ userId: "u1", organizationId: "o1" });
    const res = await confirmOwnerPinReset("not-a-token");
    expect(res.ok).toBe(false);
    expect(withTenant).not.toHaveBeenCalled();
  });

  it("rejects when the named profile is not the org's owner PARENT", async () => {
    getCurrentUserOrg.mockResolvedValue({ userId: "u1", organizationId: "o1" });
    withTenant.mockResolvedValueOnce(null); // owner lookup → not found
    const token = await freshToken({ uid: "u1", org: "o1", profileId: "p-owner" });

    const res = await confirmOwnerPinReset(token);
    expect(res.ok).toBe(false);
    expect(withTenant).toHaveBeenCalledTimes(1); // looked up, did not update
  });
});

describe("resetChildPinWithParentPin", () => {
  beforeEach(() => getCurrentUserOrg.mockResolvedValue({ userId: "u1", organizationId: "o1" }));

  it("clears the child PIN when the parent PIN verifies", async () => {
    withTenant
      .mockResolvedValueOnce({ id: "owner", pinHash: "hash" }) // owner lookup
      .mockResolvedValueOnce({ id: "c1" }) // child (STUDENT) lookup
      .mockResolvedValueOnce(undefined); // clear update
    verifyPinWithThrottle.mockResolvedValue({ ok: true });

    const res = await resetChildPinWithParentPin("c1", "1234");
    expect(res).toEqual({ ok: true });
    expect(verifyPinWithThrottle).toHaveBeenCalledWith("owner", "o1", "hash", "1234");
    expect(withTenant).toHaveBeenCalledTimes(3); // owner + child lookup + clear update
  });

  it("rejects (no clear) when the parent PIN is wrong", async () => {
    withTenant.mockResolvedValueOnce({ id: "owner", pinHash: "hash" });
    verifyPinWithThrottle.mockResolvedValue({ ok: false, error: "Incorrect PIN." });

    const res = await resetChildPinWithParentPin("c1", "0000");
    expect(res).toEqual({ ok: false, error: "Incorrect PIN." });
    expect(withTenant).toHaveBeenCalledTimes(1); // only the owner lookup; no child lookup/update
  });

  it("rejects (no clear) when the target is not an in-org STUDENT", async () => {
    withTenant
      .mockResolvedValueOnce({ id: "owner", pinHash: "hash" })
      .mockResolvedValueOnce(null); // child lookup → not a STUDENT / not found
    verifyPinWithThrottle.mockResolvedValue({ ok: true });

    const res = await resetChildPinWithParentPin("not-a-child", "1234");
    expect(res).toEqual({ ok: false, error: "Profile not found." });
    expect(withTenant).toHaveBeenCalledTimes(2); // owner + child lookup; no update
  });

  it("errors when there is no owner profile (and never checks the PIN)", async () => {
    withTenant.mockResolvedValueOnce(null); // owner lookup → none
    const res = await resetChildPinWithParentPin("c1", "1234");
    expect(res.ok).toBe(false);
    expect(verifyPinWithThrottle).not.toHaveBeenCalled();
  });
});

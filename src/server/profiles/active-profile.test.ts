import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Mocks for the I/O seams (declared before importing the module under test). ---
const getCurrentUserOrg = vi.fn();
const withTenant = vi.fn();
const cookieGet = vi.fn();

vi.mock("@/lib/auth-helpers", () => ({ getCurrentUserOrg: () => getCurrentUserOrg() }));
vi.mock("@/server/db", () => ({ withTenant: (...a: unknown[]) => withTenant(...a) }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: (n: string) => cookieGet(n) }) }));
vi.mock("server-only", () => ({}));

import { loadActiveProfile } from "./active-profile";
import { signActiveProfile, ACTIVE_PROFILE_COOKIE } from "@/lib/active-profile-cookie";

const SECRET = "test-secret-0123456789-abcdefghij-KLMNOP";
const CTX = { userId: "u1", organizationId: "o1" };
const PROFILE = { id: "p1", organizationId: "o1", type: "PARENT", displayName: "Adam", avatarConfig: null, viewMode: "STANDARD", userId: "u1", isOwner: true };

async function cookieValue(overrides: Partial<{ profileId: string; uid: string; org: string }> = {}) {
  return signActiveProfile(
    { profileId: overrides.profileId ?? "p1", type: "PARENT", uid: overrides.uid ?? "u1", org: overrides.org ?? "o1" },
    SECRET,
    Date.now(),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.AUTH_SECRET = SECRET;
  getCurrentUserOrg.mockResolvedValue(CTX);
  cookieGet.mockReturnValue(undefined);
  withTenant.mockResolvedValue(PROFILE);
});

describe("loadActiveProfile", () => {
  it("returns null when not logged in (getCurrentUserOrg throws)", async () => {
    getCurrentUserOrg.mockRejectedValue(new Error("User not authenticated"));
    expect(await loadActiveProfile()).toBeNull();
    expect(cookieGet).not.toHaveBeenCalled();
  });

  it("returns null when the logged-in user has no organization", async () => {
    getCurrentUserOrg.mockResolvedValue({ userId: "u1", organizationId: null });
    expect(await loadActiveProfile()).toBeNull();
    expect(cookieGet).not.toHaveBeenCalled();
  });

  it("returns null when there is no active_profile cookie", async () => {
    cookieGet.mockReturnValue(undefined);
    expect(await loadActiveProfile()).toBeNull();
  });

  it("returns null when the cookie is signed with the wrong secret", async () => {
    const bad = await signActiveProfile({ profileId: "p1", type: "PARENT", uid: "u1", org: "o1" }, "WRONG-secret-0123456789-abcdefghij-ZZ", Date.now());
    cookieGet.mockReturnValue({ value: bad });
    expect(await loadActiveProfile()).toBeNull();
  });

  it("returns null when the cookie's uid does not match the session", async () => {
    cookieGet.mockReturnValue({ value: await cookieValue({ uid: "someone-else" }) });
    expect(await loadActiveProfile()).toBeNull();
    expect(withTenant).not.toHaveBeenCalled();
  });

  it("returns null when the profile is not found", async () => {
    cookieGet.mockReturnValue({ value: await cookieValue() });
    withTenant.mockResolvedValue(null);
    expect(await loadActiveProfile()).toBeNull();
  });

  it("returns null when the loaded profile is in a different org", async () => {
    cookieGet.mockReturnValue({ value: await cookieValue() });
    withTenant.mockResolvedValue({ ...PROFILE, organizationId: "other-org" });
    expect(await loadActiveProfile()).toBeNull();
  });

  it("returns the profile on the happy path", async () => {
    cookieGet.mockReturnValue({ value: await cookieValue() });
    const out = await loadActiveProfile();
    expect(out).toMatchObject({ id: "p1", type: "PARENT" });
    expect(cookieGet).toHaveBeenCalledWith(ACTIVE_PROFILE_COOKIE);
  });
});

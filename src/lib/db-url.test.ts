import { describe, it, expect } from "vitest";
import { withRole, withoutSslParams } from "./db-url";

describe("withRole", () => {
  it("swaps role + password on a pooler URL, preserving host/port/db/params + tenant suffix", () => {
    expect(
      withRole(
        "postgres://postgres.abc123:oldpw@aws-1-us-east-2.pooler.supabase.com:6543/postgres?sslmode=require&supa=base-pooler.x",
        "app_user",
        "newpw",
      ),
    ).toBe(
      "postgres://app_user.abc123:newpw@aws-1-us-east-2.pooler.supabase.com:6543/postgres?sslmode=require&supa=base-pooler.x",
    );
  });

  it("handles a username without a tenant suffix (direct connection)", () => {
    expect(
      withRole("postgresql://postgres:oldpw@db.abc.supabase.co:5432/postgres", "app_user", "newpw"),
    ).toBe("postgresql://app_user:newpw@db.abc.supabase.co:5432/postgres");
  });

  it("url-encodes a password with special chars", () => {
    expect(withRole("postgres://postgres.abc:x@host:6543/postgres", "app_user", "p@ss:w/d")).toBe(
      "postgres://app_user.abc:p%40ss%3Aw%2Fd@host:6543/postgres",
    );
  });

  it("returns the url unchanged when the password is missing (fail safe)", () => {
    expect(withRole("postgres://postgres.abc:x@host:6543/postgres", "app_user", undefined)).toBe(
      "postgres://postgres.abc:x@host:6543/postgres",
    );
  });

  it("leaves a non-URL string untouched", () => {
    expect(withRole("not a url", "app_user", "pw")).toBe("not a url");
  });
});

describe("withoutSslParams", () => {
  it("strips sslmode but keeps the pooler routing param + host", () => {
    const out = withoutSslParams(
      "postgres://u:p@aws-1-us-east-2.pooler.supabase.com:6543/db?sslmode=require&supa=base-pooler.x",
    );
    expect(out).not.toContain("sslmode");
    expect(out).toContain("supa=base-pooler.x");
    expect(out).toContain("aws-1-us-east-2.pooler.supabase.com:6543");
  });
});

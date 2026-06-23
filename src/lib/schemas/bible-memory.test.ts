import { describe, it, expect } from "vitest";
import {
  addVerseSchema,
  createFolderSchema,
  renameFolderSchema,
  moveVerseSchema,
} from "./bible-memory";

const UUID = "550e8400-e29b-41d4-a716-446655440000";
const UUID2 = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";
const CUID = "clabc123def456ghi789jkl0"; // cuid-style, NOT a uuid

describe("addVerseSchema", () => {
  it("accepts a valid uuid studentId + reference (text optional)", () => {
    expect(addVerseSchema.safeParse({ studentId: UUID, reference: "John 3:16" }).success).toBe(true);
    expect(addVerseSchema.safeParse({ studentId: UUID, reference: "John 3:16", text: "For God..." }).success).toBe(true);
  });
  it("rejects a non-uuid (cuid-style) studentId", () => {
    expect(addVerseSchema.safeParse({ studentId: CUID, reference: "John 3:16" }).success).toBe(false);
  });
  it("rejects an empty reference and an over-long reference (>100)", () => {
    expect(addVerseSchema.safeParse({ studentId: UUID, reference: "" }).success).toBe(false);
    expect(addVerseSchema.safeParse({ studentId: UUID, reference: "x".repeat(101) }).success).toBe(false);
  });
});

describe("createFolderSchema / renameFolderSchema", () => {
  it("accepts a valid uuid + 1-50 char name", () => {
    expect(createFolderSchema.safeParse({ studentId: UUID, name: "Memory Box" }).success).toBe(true);
    expect(renameFolderSchema.safeParse({ folderId: UUID, name: "Renamed" }).success).toBe(true);
  });
  it("rejects empty + over-long (>50) names", () => {
    expect(createFolderSchema.safeParse({ studentId: UUID, name: "" }).success).toBe(false);
    expect(createFolderSchema.safeParse({ studentId: UUID, name: "x".repeat(51) }).success).toBe(false);
  });
  it("rejects a non-uuid id", () => {
    expect(createFolderSchema.safeParse({ studentId: CUID, name: "ok" }).success).toBe(false);
    expect(renameFolderSchema.safeParse({ folderId: CUID, name: "ok" }).success).toBe(false);
  });
});

describe("moveVerseSchema", () => {
  it("accepts a uuid verseId with a uuid OR null folderId (unfile)", () => {
    expect(moveVerseSchema.safeParse({ verseId: UUID, folderId: UUID2 }).success).toBe(true);
    expect(moveVerseSchema.safeParse({ verseId: UUID, folderId: null }).success).toBe(true);
  });
  it("rejects a non-uuid verseId", () => {
    expect(moveVerseSchema.safeParse({ verseId: CUID, folderId: null }).success).toBe(false);
  });
});

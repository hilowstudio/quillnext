"use server";

import { auth } from "@/auth";
import { db } from "@/server/db";
import type { CatechismSummary } from "./types";

// Q-20-001: catechism content is GLOBAL reference data (no org filter), but require a session so the
// actions are self-gating (defense-in-depth on top of the proxy — src/proxy.ts is a backstop, not a
// replacement).
async function requireSession() {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
}

/** Lightweight metadata for the catechism selection carousel. */
export async function getCatechisms(): Promise<CatechismSummary[]> {
  await requireSession();
  const rows = await db.catechism.findMany({
    orderBy: { sortOrder: "asc" },
    select: { code: true, title: true, description: true, questionCount: true, difficulty: true },
  });
  return rows.map((r) => ({
    id: r.code,
    title: r.title,
    description: r.description ?? "",
    questionCount: r.questionCount,
    difficulty: r.difficulty ?? "",
  }));
}

/**
 * Returns the ordered question objects for a catechism — the same shape the
 * component previously imported from the bundled TS data (question/answer/
 * proofTexts/subQuestions). Lazy-loaded on selection. [] if code is unknown.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getCatechismQuestions(code: string): Promise<any[]> {
  await requireSession();
  const cat = await db.catechism.findUnique({ where: { code }, select: { id: true } });
  if (!cat) return [];

  const rows = await db.catechismQuestion.findMany({
    where: { catechismId: cat.id },
    orderBy: { sortOrder: "asc" },
    select: { data: true },
  });

  return rows.map((r) => r.data);
}

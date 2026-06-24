import type { Prisma } from "@/generated/client";
import type { getLibraryResources } from "@/app/actions/resource-library-actions";

// Single source of truth for the Living Library's server→client payload shapes, so the
// client list components can't drift from what the page actually fetches.
//
// The five base collections come from getLibraryResources (the DAL the page calls); derive
// each element type from that query's real return rather than re-declaring it.
type LibraryResources = Awaited<ReturnType<typeof getLibraryResources>>;

export type LibraryBook = LibraryResources["books"][number];
export type LibraryVideo = LibraryResources["videos"][number];
export type LibraryArticle = LibraryResources["articles"][number];
export type LibraryDocument = LibraryResources["documents"][number];
export type LibraryCourse = LibraryResources["courses"][number];

// Students for the resource filter come from an inline learner.findMany in the page.
export type LibraryStudent = Prisma.LearnerGetPayload<{
  select: { id: true; firstName: true; lastName: true; preferredName: true };
}>;

// Generated resources come from the page's filtered resource.findMany. Keep the select here as
// the single source of truth so the page query and the card prop type can't drift.
// NOTE: description + generationContext are read by GeneratedResourceCard — they must be selected
// (they were previously omitted, so those UI sections silently rendered blank).
export const libraryResourceSelect = {
  id: true,
  title: true,
  description: true,
  content: true,
  storageType: true,
  createdAt: true,
  generationContext: true,
  resourceKind: { select: { id: true, code: true, label: true } },
  student: { select: { id: true, firstName: true, lastName: true, preferredName: true } },
  book: { select: { id: true, title: true } },
  video: { select: { id: true, title: true } },
  createdByUser: { select: { id: true, name: true } },
} satisfies Prisma.ResourceSelect;

export type LibraryGeneratedResource = Prisma.ResourceGetPayload<{
  select: typeof libraryResourceSelect;
}>;

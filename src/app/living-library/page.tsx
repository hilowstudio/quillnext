import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db as prisma, withTenant } from "@/server/db";
import { Prisma } from "@/generated/client";
import { excludeParentLearners } from "@/server/queries/learner-filters";
import { getLibraryResources } from "@/app/actions/resource-library-actions";
import { libraryResourceSelect } from "@/components/library/library-types";
import { LibraryClient } from "@/app/living-library/LibraryClient";

export default async function LibraryPage(
  props: {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
  }
) {
  const searchParams = await props.searchParams;
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/auth/login");
  }

  const userId = session.user.id;
  // Fetch organizationId for the user, logic similar to generator page
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { organizationId: true },
  });

  if (!user?.organizationId) {
    return <div>Organization not found</div>;
  }

  const organizationId = user.organizationId;

  // Fetch basic library resources
  const { books, videos, articles, documents, courses } = await getLibraryResources(organizationId);

  // Fetch Students (needed for filtering options in LibraryClient -> ResourceList)
  const students = await withTenant(
    (tx) =>
      tx.learner.findMany({
        where: { organizationId, ...excludeParentLearners },
        select: { id: true, firstName: true, lastName: true, preferredName: true },
        orderBy: { createdAt: "desc" },
      }),
    undefined,
    { organizationId, userId: null }
  );

  // Fetch Filtered Generated Resources logic. searchParams values are string | string[] |
  // undefined (Next typing); coerce each to a single string so a duplicate query param can't
  // flow a string[] into a scalar Prisma filter (which would throw a validation error and 500
  // the page). The organizationId predicate is unconditional, so the catalog stays org-scoped.
  const firstParam = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const where: Prisma.ResourceWhereInput = { organizationId };

  const studentId = firstParam(searchParams.studentId);
  const courseId = firstParam(searchParams.courseId);
  const bookId = firstParam(searchParams.bookId);
  const toolType = firstParam(searchParams.toolType);

  if (studentId) where.generatedForStudentId = studentId;
  if (courseId) where.assignments = { some: { courseId } };
  if (bookId) where.generatedFromBookId = bookId;
  if (toolType) where.resourceKind = { code: toolType };

  // Converted include to select for precise field selection
  const resources = await withTenant(
    (tx) =>
      tx.resource.findMany({
        where,
        select: libraryResourceSelect,
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
    undefined,
    { organizationId, userId: null }
  );


  // Initial data for the client component
  const initialData = {
    books: books || [],
    videos: videos || [],
    articles: articles || [],
    documents: documents || [],
    courses: courses || [],
    resources: resources || [],
    students: students || [],
  };

  return (
    <LibraryClient
      initialData={initialData}
      organizationId={user.organizationId}
    />
  );
}


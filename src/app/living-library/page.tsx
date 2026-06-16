import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db as prisma, withTenant } from "@/server/db";
import { getLibraryResources } from "@/app/actions/resource-library-actions";
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
      tx.student.findMany({
        where: { organizationId },
        select: { id: true, firstName: true, lastName: true, preferredName: true },
        orderBy: { createdAt: "desc" },
      }),
    undefined,
    { organizationId, userId: null }
  );

  // Fetch Filtered Generated Resources logic
  const where: any = { organizationId };

  if (searchParams.studentId) where.generatedForStudentId = searchParams.studentId;
  if (searchParams.courseId) where.assignments = { some: { courseId: searchParams.courseId } };
  if (searchParams.bookId) where.generatedFromBookId = searchParams.bookId;
  if (searchParams.toolType) where.resourceKind = { code: searchParams.toolType };

  // Converted include to select for precise field selection
  const resources = await withTenant(
    (tx) =>
      tx.resource.findMany({
    where,
    select: {
      id: true,
      title: true,
      content: true,
      storageType: true,
      createdAt: true,
      resourceKind: {
        select: {
          id: true,
          code: true,
          label: true,
        },
      },
      student: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          preferredName: true,
        },
      },
      book: {
        select: {
          id: true,
          title: true,
        },
      },
      video: {
        select: {
          id: true,
          title: true,
        },
      },
      createdByUser: {
        select: {
          id: true,
          name: true,
        },
      },
    },
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
      userId={userId}
    />
  );
}


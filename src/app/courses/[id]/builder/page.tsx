import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getCurrentUserOrg } from "@/lib/auth-helpers";
import { db, withTenant } from "@/server/db";
import { Prisma } from "@/generated/client";
import { getMasterContext } from "@/lib/context/master-context";
import { serializeMasterContext } from "@/lib/context/context-serializer";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ContextBadges } from "@/components/context/ContextBadges";
import { ContextCompleteness } from "@/components/context/ContextCompleteness";
import { analyzeContextCompleteness } from "@/lib/context/context-suggestions";
import Link from "next/link";
import { CourseBuilder } from "@/components/courses/CourseBuilder";
import { CourseDistributor } from "@/components/courses/CourseDistributor";

export default async function CourseBuilderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  const { id } = await params;

  if (!session?.user) {
    redirect("/login");
  }

  const { organizationId } = await getCurrentUserOrg();
  if (!organizationId) {
    redirect("/courses");
  }

  const courseInclude = {
    subject: true,
    strand: true,
    gradeBand: true,
    blocks: {
      orderBy: { position: "asc" },
      include: {
        activities: {
          include: {
            objectives: {
              include: {
                objective: true,
              },
            },
          },
          orderBy: { position: "asc" },
        },
      },
    },
    students: {
      include: {
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            preferredName: true,
          },
        },
      },
    },
  } satisfies Prisma.CourseInclude;

  const course = await withTenant(
    (tx) =>
      tx.course.findUnique({
        where: { id },
        include: courseInclude,
      }),
    undefined,
    { organizationId, userId: null }
  ) as Prisma.CourseGetPayload<{ include: typeof courseInclude }> | null;

  if (!course || course.organizationId !== organizationId) {
    redirect("/courses");
  }

  // Get master context for this course
  const masterContext = await getMasterContext({
    organizationId,
    courseId: course.id,
  });

  const contextPreview = serializeMasterContext(masterContext, {
    includeDetails: true,
    maxTokens: 2000,
    prioritize: ["academic", "family", "library", "schedule"],
  });

  // Get context completeness
  const { completeness, suggestions } = await analyzeContextCompleteness(organizationId, {
    courseId: course.id,
  });

  // Get relevant books for this course - converted include to select
  const relevantBooks = await withTenant(
    (tx) =>
      tx.book.findMany({
        where: {
          organizationId,
          OR: [
            { subjectId: course.subjectId },
            { strandId: course.strandId || undefined },
          ],
        },
        select: {
          id: true,
          title: true,
          authors: true,
          summary: true,
          subject: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
          strand: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
        },
        take: 10,
      }),
    undefined,
    { organizationId, userId: null }
  );

  // Get available tools for this strand
  const availableTools = await db.resourceKind.findMany({
    where: {
      OR: [
        { strandId: course.strandId || undefined },
        { subjectId: course.subjectId },
        { strandId: null, subjectId: null, isSpecialized: false },
      ],
    },
    take: 10,
    orderBy: { label: "asc" },
  });

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
      <div className="mb-8">
        <h1 className="font-display text-4xl font-bold text-qc-charcoal mb-2 text-balance">
          {course.title}
        </h1>
        <p className="font-body text-qc-text-muted mb-4">{course.description}</p>
        <div className="flex gap-2 flex-wrap items-center mb-3">
          <span className="px-3 py-1 bg-qc-primary/10 text-qc-primary rounded-full text-sm font-body">
            {course.subject.name}
          </span>
          {course.strand && (
            <span className="px-3 py-1 bg-qc-parchment rounded-full text-sm font-body text-qc-charcoal">
              {course.strand.name}
            </span>
          )}
          {course.gradeBand && (
            <span className="px-3 py-1 bg-qc-parchment rounded-full text-sm font-body text-qc-charcoal">
              {course.gradeBand.name}
            </span>
          )}
          {course.students.length > 0 && (
            <span className="px-3 py-1 bg-qc-primary/10 text-qc-primary rounded-full text-sm font-body">
              {course.students.length} student{course.students.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>
        <ContextBadges course={course} />
        <div className="mt-4">
          <ContextCompleteness completeness={completeness} suggestions={suggestions} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Builder */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="font-display text-xl">Course Structure</CardTitle>
                  <CardDescription>
                    Build your course with units, modules, and lessons
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {course.blocks.length === 0 ? (
                <div className="text-center py-12">
                  <p className="font-body text-qc-text-muted mb-4">
                    No course blocks yet. Start building your course structure.
                  </p>
                  <Button asChild>
                    <Link href={`/courses/${course.id}/blocks/new`}>Add First Block</Link>
                  </Button>
                </div>
              ) : (
                <CourseBuilder
                  courseId={course.id}
                  organizationId={organizationId}
                  initialBlocks={course.blocks}
                  availableTools={availableTools}
                  initialContext={{
                    subject: course.subject.name,
                    topic: course.strand?.name,
                    readingLevel: course.gradeBand?.name
                  }}
                />
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Context Usage */}
          <Card>
            <CardHeader>
              <CardTitle className="font-display text-lg">Context Integration</CardTitle>
              <CardDescription>
                This course uses context from your family blueprint
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="p-3 bg-qc-primary/5 rounded-qc-md border border-qc-primary/20">
                <p className="font-body text-xs font-medium text-qc-primary mb-1">
                  Academic Spine
                </p>
                <p className="font-body text-sm text-qc-charcoal">
                  {course.subject.name}
                  {course.strand && ` > ${course.strand.name}`}
                </p>
              </div>

              {course.students.length > 0 && (
                <div className="p-3 bg-qc-parchment rounded-qc-md border border-qc-border-subtle">
                  <p className="font-body text-xs font-medium text-qc-text-muted mb-1">
                    Enrolled Students
                  </p>
                  <div className="space-y-1">
                    {course.students.map((cs) => (
                      <p key={cs.studentId} className="font-body text-sm text-qc-charcoal">
                        {cs.student.preferredName || cs.student.firstName} {cs.student.lastName}
                      </p>
                    ))}
                  </div>
                  <p className="font-body text-xs text-qc-text-muted mt-2">
                    Content will be personalized for these students
                  </p>
                </div>
              )}

              {relevantBooks.length > 0 && (
                <div className="p-3 bg-qc-parchment rounded-qc-md border border-qc-border-subtle">
                  <p className="font-body text-xs font-medium text-qc-text-muted mb-2">
                    Relevant Books
                  </p>
                  <div className="space-y-1">
                    {relevantBooks.slice(0, 3).map((book) => (
                      <p key={book.id} className="font-body text-xs text-qc-charcoal line-clamp-1">
                        {book.title}
                      </p>
                    ))}
                  </div>
                  {relevantBooks.length > 3 && (
                    <p className="font-body text-xs text-qc-text-muted mt-1">
                      +{relevantBooks.length - 3} more
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Available Tools */}
          {availableTools.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="font-display text-lg">Recommended Tools</CardTitle>
                <CardDescription>
                  Generators relevant to this course
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {availableTools.slice(0, 5).map((tool) => (
                    <Button
                      key={tool.id}
                      variant="outline"
                      size="sm"
                      className="w-full justify-start"
                      asChild
                    >
                      <Link href={`/creation-station/${tool.id}?courseId=${course.id}`}>
                        {tool.label}
                      </Link>
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}


          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="font-display text-lg">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <CourseDistributor
                courseId={course.id}
                students={course.students.map(s => ({
                  studentId: s.student.id,
                  student: {
                    firstName: s.student.firstName,
                    lastName: s.student.lastName
                  }
                }))}
              />
              <Button variant="outline" className="w-full justify-start" asChild>
                <Link href={`/creation-station?courseId=${course.id}`}>
                  Generate Content for Course
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div >
    </div >
  );
}


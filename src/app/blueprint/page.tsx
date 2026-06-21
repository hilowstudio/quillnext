import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getCurrentUserOrg } from "@/lib/auth-helpers";
import { getBlueprintProgress } from "@/server/actions/blueprint";
import { getMasterContext } from "@/lib/context/master-context";
import { serializeMasterContext } from "@/lib/context/context-serializer";
import { withTenant } from "@/server/db";
import { excludeParentLearners } from "@/server/queries/learner-filters";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default async function BlueprintPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const { organizationId } = await getCurrentUserOrg();
  if (!organizationId) {
    redirect("/onboarding");
  }

  const progress = await getBlueprintProgress(organizationId);

  if (!progress.data) {
    redirect("/onboarding");
  }

  // Get master context for preview
  const masterContext = await getMasterContext({
    organizationId,
  });

  // Get counts for context completeness
  const [studentsCount, studentsWithProfilesCount, booksCount, coursesCount] = await Promise.all([
    withTenant((tx) => tx.learner.count({ where: { organizationId, ...excludeParentLearners } }), undefined, { organizationId, userId: null }),
    withTenant((tx) => tx.learner.count({
      where: {
        organizationId,
        learnerProfile: { isNot: null },
        ...excludeParentLearners,
      },
    }), undefined, { organizationId, userId: null }),
    withTenant((tx) => tx.book.count({ where: { organizationId } }), undefined, { organizationId, userId: null }),
    withTenant((tx) => tx.course.count({ where: { organizationId } }), undefined, { organizationId, userId: null }),
  ]);

  // Calculate context completeness score
  const contextItems = {
    family: masterContext.family ? 1 : 0,
    schedule: masterContext.schedule ? 1 : 0,
    students: studentsCount > 0 ? 1 : 0,
    studentProfiles: studentsWithProfilesCount > 0 ? 1 : 0,
    library: booksCount > 0 ? 1 : 0,
  };
  const totalItems = Object.keys(contextItems).length;
  const completedItems = Object.values(contextItems).reduce((sum, val) => sum + val, 0);
  const completenessScore = Math.round((completedItems / totalItems) * 100);

  const contextPreview = serializeMasterContext(masterContext, {
    includeDetails: true,
    maxTokens: 3000,
  });

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
      <div className="mb-8">
        <h1 className="font-display text-4xl font-bold text-qc-charcoal mb-2 text-balance">
          Family Blueprint
        </h1>
        <p className="font-body text-qc-text-muted qc-prose">
          Your educational foundation that powers Inkling personalization
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Classroom Info */}
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-xl">Classroom Information</CardTitle>
            <CardDescription>Basic classroom setup</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="font-body text-sm font-medium text-qc-text-muted mb-1">Name</p>
              <p className="font-body text-qc-charcoal">{progress.data.name}</p>
            </div>
            {progress.data.description && (
              <div>
                <p className="font-body text-sm font-medium text-qc-text-muted mb-1">Description</p>
                <p className="font-body text-qc-charcoal">{progress.data.description}</p>
              </div>
            )}
            <div>
              <p className="font-body text-sm font-medium text-qc-text-muted mb-1">Educational Philosophy</p>
              <p className="font-body text-qc-charcoal">{progress.data.educationalPhilosophy}</p>
              {progress.data.educationalPhilosophyOther && (
                <p className="font-body text-sm text-qc-text-secondary mt-1">
                  {progress.data.educationalPhilosophyOther}
                </p>
              )}
            </div>
            <div>
              <p className="font-body text-sm font-medium text-qc-text-muted mb-1">Faith Background</p>
              <p className="font-body text-qc-charcoal">{progress.data.faithBackground}</p>
              {progress.data.faithBackgroundOther && (
                <p className="font-body text-sm text-qc-text-secondary mt-1">
                  {progress.data.faithBackgroundOther}
                </p>
              )}
            </div>
            <Button variant="outline" asChild>
              <a href="/onboarding?step=1">Edit Classroom</a>
            </Button>
          </CardContent>
        </Card>

        {/* Schedule Info */}
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-xl">Schedule</CardTitle>
            <CardDescription>School year and daily schedule</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="font-body text-sm font-medium text-qc-text-muted mb-1">School Year</p>
              <p className="font-body text-qc-charcoal">
                {progress.data.schoolYearStartDate.toLocaleDateString()} -{" "}
                {progress.data.schoolYearEndDate.toLocaleDateString()}
              </p>
            </div>
            {progress.data.dailyStartTime && progress.data.dailyEndTime && (
              <div>
                <p className="font-body text-sm font-medium text-qc-text-muted mb-1">Daily Schedule</p>
                <p className="font-body text-qc-charcoal">
                  {progress.data.dailyStartTime.toLocaleTimeString([], {
                    hour: "numeric",
                    minute: "2-digit",
                  })}{" "}
                  -{" "}
                  {progress.data.dailyEndTime.toLocaleTimeString([], {
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </p>
              </div>
            )}
            <div>
              <p className="font-body text-sm font-medium text-qc-text-muted mb-1">School Days</p>
              <p className="font-body text-qc-charcoal">
                {((progress.data.schoolDaysOfWeek as number[]) || []).length} days per week
              </p>
            </div>
            {(progress.data as any).holidays && Array.isArray((progress.data as any).holidays) && (progress.data as any).holidays.length > 0 && (
              <div>
                <p className="font-body text-sm font-medium text-qc-text-muted mb-1">Planned Holidays</p>
                <p className="font-body text-qc-charcoal">{(progress.data as any).holidays.length} holidays scheduled</p>
              </div>
            )}
            <Button variant="outline" asChild>
              <a href="/onboarding?step=2">Edit Schedule</a>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* AI Context Preview */}
      <Card>
        <CardHeader>
          <CardTitle className="font-display text-xl">AI Context Preview</CardTitle>
          <CardDescription>
            This is the context that will be used for all AI-generated content
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="bg-qc-warm-stone rounded-qc-md p-4">
            <pre className="font-mono text-xs text-qc-charcoal whitespace-pre-wrap overflow-x-auto">
              {contextPreview || "No context available. Complete onboarding to enable AI personalization."}
            </pre>
          </div>
          <div className="mt-4 flex gap-2">
            <Button variant="outline" asChild>
              <a href="/onboarding?step=3">Edit Environment</a>
            </Button>
            <form action={async () => {
              "use server";
              // Copy to clipboard would need to be client-side
              // For now, we'll just show the context
            }}>
              <Button variant="outline" type="button" asChild>
                <a href={`data:text/plain;charset=utf-8,${encodeURIComponent(contextPreview)}`} download="context-preview.txt">
                  Download Context
                </a>
              </Button>
            </form>
          </div>
        </CardContent>
      </Card>

      {/* Context Completeness Score */}
      <Card className="mt-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="font-display text-xl">Context Completeness</CardTitle>
              <CardDescription>How complete is your family blueprint?</CardDescription>
            </div>
            <div className="text-right">
              <div className="font-display text-4xl font-bold text-qc-primary">
                {completenessScore}%
              </div>
              <p className="font-body text-xs text-qc-text-muted mt-1">Complete</p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Progress Bar */}
            <div className="w-full bg-qc-warm-stone rounded-full h-3 overflow-hidden">
              <div
                className="h-full bg-qc-primary transition-all duration-500"
                style={{ width: `${completenessScore}%` }}
              />
            </div>

            {/* Context Items */}
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-qc-md bg-qc-parchment">
                <div className="flex items-center gap-3">
                  <span className={`text-lg ${masterContext.family ? "text-qc-success" : "text-qc-text-muted"}`}>
                    {masterContext.family ? "✓" : "○"}
                  </span>
                  <div>
                    <span className="font-body font-medium text-qc-charcoal">Family Context</span>
                    <p className="font-body text-xs text-qc-text-muted">
                      Educational philosophy and preferences
                    </p>
                  </div>
                </div>
                {!masterContext.family && (
                  <Button variant="outline" size="sm" asChild>
                    <Link href="/onboarding?step=1">Complete</Link>
                  </Button>
                )}
              </div>

              <div className="flex items-center justify-between p-3 rounded-qc-md bg-qc-parchment">
                <div className="flex items-center gap-3">
                  <span className={`text-lg ${masterContext.schedule ? "text-qc-success" : "text-qc-text-muted"}`}>
                    {masterContext.schedule ? "✓" : "○"}
                  </span>
                  <div>
                    <span className="font-body font-medium text-qc-charcoal">Schedule Context</span>
                    <p className="font-body text-xs text-qc-text-muted">
                      School year, days, and holidays
                    </p>
                  </div>
                </div>
                {!masterContext.schedule && (
                  <Button variant="outline" size="sm" asChild>
                    <Link href="/onboarding?step=2">Complete</Link>
                  </Button>
                )}
              </div>

              <div className="flex items-center justify-between p-3 rounded-qc-md bg-qc-parchment">
                <div className="flex items-center gap-3">
                  <span className={`text-lg ${studentsCount > 0 ? "text-qc-success" : "text-qc-text-muted"}`}>
                    {studentsCount > 0 ? "✓" : "○"}
                  </span>
                  <div>
                    <span className="font-body font-medium text-qc-charcoal">Students</span>
                    <p className="font-body text-xs text-qc-text-muted">
                      {studentsCount > 0
                        ? `${studentsCount} student${studentsCount !== 1 ? "s" : ""} added`
                        : "Add students to enable personalization"}
                    </p>
                  </div>
                </div>
                {studentsCount === 0 && (
                  <Button variant="outline" size="sm" asChild>
                    <Link href="/students">Add Students</Link>
                  </Button>
                )}
              </div>

              <div className="flex items-center justify-between p-3 rounded-qc-md bg-qc-parchment">
                <div className="flex items-center gap-3">
                  <span className={`text-lg ${studentsWithProfilesCount > 0 ? "text-qc-success" : "text-qc-warning"}`}>
                    {studentsWithProfilesCount > 0 ? "✓" : "○"}
                  </span>
                  <div>
                    <span className="font-body font-medium text-qc-charcoal">Student Profiles</span>
                    <p className="font-body text-xs text-qc-text-muted">
                      {studentsWithProfilesCount > 0
                        ? `${studentsWithProfilesCount} profile${studentsWithProfilesCount !== 1 ? "s" : ""} completed`
                        : studentsCount > 0
                          ? "Complete personality assessments"
                          : "Add students first"}
                    </p>
                  </div>
                </div>
                {studentsCount > 0 && studentsWithProfilesCount === 0 && (
                  <Button variant="outline" size="sm" asChild>
                    <Link href="/students">Assess Students</Link>
                  </Button>
                )}
              </div>

              <div className="flex items-center justify-between p-3 rounded-qc-md bg-qc-parchment">
                <div className="flex items-center gap-3">
                  <span className={`text-lg ${booksCount > 0 ? "text-qc-success" : "text-qc-text-muted"}`}>
                    {booksCount > 0 ? "✓" : "○"}
                  </span>
                  <div>
                    <span className="font-body font-medium text-qc-charcoal">Library Resources</span>
                    <p className="font-body text-xs text-qc-text-muted">
                      {booksCount > 0
                        ? `${booksCount} book${booksCount !== 1 ? "s" : ""} in library`
                        : "Add books to enhance context"}
                    </p>
                  </div>
                </div>
                {booksCount === 0 && (
                  <Button variant="outline" size="sm" asChild>
                    <Link href="/living-library/scan">Add Books</Link>
                  </Button>
                )}
              </div>
            </div>

            {/* Impact Preview */}
            {completenessScore < 100 && (
              <div className="mt-6 p-4 bg-qc-warm-stone rounded-qc-md border border-qc-border-subtle">
                <p className="font-body text-sm font-medium text-qc-charcoal mb-2">
                  Complete your blueprint to unlock:
                </p>
                <ul className="font-body text-xs text-qc-text-muted space-y-1 list-disc list-inside">
                  {!masterContext.family && (
                    <li>Personalized content that matches your educational philosophy</li>
                  )}
                  {!masterContext.schedule && (
                    <li>Automatic course pacing based on your schedule</li>
                  )}
                  {studentsCount === 0 && (
                    <li>Student-specific learning materials and recommendations</li>
                  )}
                  {studentsWithProfilesCount === 0 && studentsCount > 0 && (
                    <li>AI that adapts to each student's learning style and preferences</li>
                  )}
                  {booksCount === 0 && (
                    <li>Content generation from your library resources</li>
                  )}
                </ul>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}


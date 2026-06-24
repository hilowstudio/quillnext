import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getCurrentUserOrg } from "@/lib/auth-helpers";
import { withTenant } from "@/server/db";
import { getMasterContext } from "@/lib/context/master-context";
import { serializeMasterContext } from "@/lib/context/context-serializer";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { GradingInterface } from "@/components/grading/GradingInterface";
import Link from "next/link";

export default async function GradingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const { organizationId } = await getCurrentUserOrg();
  if (!organizationId) {
    redirect("/grading");
  }

  const attempt = (await withTenant(
    (tx) =>
      tx.assessmentAttempt.findUnique({
        where: { id },
        include: {
          assessment: {
            include: {
              course: {
                include: {
                  subject: true,
                  strand: true,
                },
              },
              items: {
                orderBy: { position: "asc" },
              },
            },
          },
          student: {
            include: {
              learnerProfile: true,
            },
          },
          itemResponses: {
            include: {
              item: true,
            },
            orderBy: {
              item: {
                position: "asc",
              },
            },
          },
        },
      }),
    undefined,
    { organizationId, userId: null },
  ));

  if (!attempt || !attempt.assessment?.course || attempt.assessment.course.organizationId !== organizationId) {
    redirect("/grading");
  }

  // Get master context for Inkling-assisted grading
  const masterContext = await getMasterContext({
    organizationId,
    studentId: attempt.studentId,
    courseId: attempt.assessment.courseId,
  });

  const contextPreview = serializeMasterContext(masterContext, {
    includeDetails: true,
    maxTokens: 2000,
    prioritize: ["student", "academic", "family"],
  });

  // Get student's personality profile for personalized feedback
  // NOTE: kept `as any` deliberately — the Student Context card below reads `communicationStyle`
  // (:~138) and `primaryDrivers` (:~142/148), which are NOT fields of the PersonalityProfile schema
  // (src/server/ai/personality.ts) — stale names that are always undefined at runtime. parsePersonalityData()
  // would (correctly) reject them. Pending an owner decision on what that card should display (wire to real
  // fields vs. remove), this read stays untyped. See the as-any burndown notes (wave 14).
  const personalityData = attempt.student.learnerProfile?.personalityData as any;

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
      <div className="mb-8">
        <Button variant="outline" asChild className="mb-4">
          <Link href="/grading">← Back to Grading</Link>
        </Button>
        <h1 className="font-display text-4xl font-bold text-qc-charcoal mb-2 text-balance">
          Grading: {attempt.assessment.title}
        </h1>
        <div className="flex gap-2 flex-wrap">
          <span className="px-3 py-1 bg-qc-primary/10 text-qc-primary rounded-full text-sm font-body">
            {attempt.student.preferredName || attempt.student.firstName} {attempt.student.lastName}
          </span>
          <span className="px-3 py-1 bg-qc-parchment rounded-full text-sm font-body text-qc-charcoal">
            {attempt.assessment.course.title}
          </span>
          <span className="px-3 py-1 bg-qc-parchment rounded-full text-sm font-body text-qc-charcoal">
            Status: {attempt.status}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Grading Interface */}
        <div className="lg:col-span-2">
          <GradingInterface
            attempt={attempt}
            personalityData={personalityData}
          />
        </div>

        {/* Context Sidebar */}
        <div className="space-y-6">
          {/* Student Context */}
          {personalityData && (
            <Card>
              <CardHeader>
                <CardTitle className="font-display text-lg">Student Context</CardTitle>
                <CardDescription>
                  Feedback will be personalized using this student&apos;s profile
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {personalityData.suggestedSystemPrompt && (
                  <div className="p-3 bg-qc-primary/5 rounded-qc-md border border-qc-primary/20">
                    <p className="font-body text-xs font-medium text-qc-primary mb-1">
                      Communication Style
                    </p>
                    <p className="font-body text-xs text-qc-charcoal">
                      {personalityData.communicationStyle || "Standard"}
                    </p>
                  </div>
                )}
                {personalityData.primaryDrivers && personalityData.primaryDrivers.length > 0 && (
                  <div>
                    <p className="font-body text-xs font-medium text-qc-text-muted mb-2">
                      Primary Motivators
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {personalityData.primaryDrivers.slice(0, 3).map((driver: string, idx: number) => (
                        <span
                          key={idx}
                          className="px-2 py-1 bg-qc-parchment rounded-full text-xs font-body text-qc-charcoal"
                        >
                          {driver}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Context Preview */}
          <Card>
            <CardHeader>
              <CardTitle className="font-display text-lg">Inkling Context</CardTitle>
              <CardDescription>
                Context used for Inkling-assisted grading
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="bg-qc-warm-stone rounded-qc-md p-3 max-h-96 overflow-y-auto">
                <pre className="font-mono text-xs text-qc-charcoal whitespace-pre-wrap">
                  {contextPreview || "No context available"}
                </pre>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}


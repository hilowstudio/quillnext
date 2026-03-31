import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getCurrentUserOrg } from "@/lib/auth-helpers";
import { getMasterContext } from "@/lib/context/master-context";
import { serializeMasterContext } from "@/lib/context/context-serializer";
import { analyzeContextCompleteness } from "@/lib/context/context-suggestions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ContextCompleteness } from "@/components/context/ContextCompleteness";
import { ContextInspectorClient } from "@/components/context/ContextInspectorClient";

export default async function ContextPage(
  props: {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
  }
) {
  const searchParams = await props.searchParams;
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const studentId = typeof searchParams.studentId === 'string' ? searchParams.studentId : undefined;
  const objectiveId = typeof searchParams.objectiveId === 'string' ? searchParams.objectiveId : undefined;
  const courseId = typeof searchParams.courseId === 'string' ? searchParams.courseId : undefined;

  const { organizationId } = await getCurrentUserOrg();
  if (!organizationId) {
    redirect("/onboarding");
  }

  // Get master context
  const masterContext = await getMasterContext({
    organizationId,
    studentId,
    objectiveId,
    courseId,
  });

  // Get context completeness
  const { completeness, suggestions } = await analyzeContextCompleteness(organizationId, {
    studentId,
    objectiveId,
    courseId,
  });

  // Serialize context for display
  const contextPreview = serializeMasterContext(masterContext, {
    includeDetails: true,
    maxTokens: 10000,
    prioritize: ["academic", "student", "family", "library", "schedule"],
  });

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
      <div className="mb-8">
        <h1 className="font-display text-4xl font-bold text-qc-charcoal mb-2 text-balance">
          Context Inspector
        </h1>
        <p className="font-body text-qc-text-muted qc-prose">
          Inspect and understand the Master Context System used for Inkling personalization
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <ContextCompleteness completeness={completeness} suggestions={suggestions} />
      </div>

      <ContextInspectorClient
        masterContext={masterContext}
        contextPreview={contextPreview}
        organizationId={organizationId}
        studentId={studentId}
        objectiveId={objectiveId}
        courseId={courseId}
      />
    </div>
  );
}


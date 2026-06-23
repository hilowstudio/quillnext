"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { generateResource } from "@/app/actions/generate-resource";
import { resolveGenerationSource } from "@/lib/generators/resolve-source";

interface GeneratorFormProps {
  resourceKindId: string;
  resourceKindCode: string;
  resourceKindLabel: string;
  contentType: string;
  contextParams: {
    organizationId: string;
    studentId?: string;
    objectiveId?: string;
    courseId?: string;
    courseBlockId?: string;
    bookId?: string;
    videoId?: string;
    articleId?: string;
    documentId?: string;
    subject?: string;
    readingLevel?: string;
  };
}

/**
 * Generation form for the source-aware pipeline (Q-09-005 consolidation). Maps the multi-dimensional
 * context to a single (sourceType, sourceId) via `resolveGenerationSource` and calls `generateResource`
 * (→ `generateResourceCore`: source-grounded RAG + student personalization + verify/revise + images),
 * which saves a Resource and returns its id. Replaces the old `generateLearningTool`/`streamUI` path.
 */
export function GeneratorForm({ resourceKindId, resourceKindLabel, contextParams }: GeneratorFormProps) {
  const [userPrompt, setUserPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [resultId, setResultId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userPrompt.trim()) return;

    setIsGenerating(true);
    setResultId(null);
    setError(null);

    try {
      const prompt = userPrompt.trim();
      const src = resolveGenerationSource(contextParams, prompt);
      const result = await generateResource(
        src.sourceId,
        src.sourceType,
        resourceKindId,
        prompt,
        { studentId: contextParams.studentId, ...src.additionalData },
      );
      setResultId(result.resourceId);
    } catch (err) {
      console.error("Generation error:", err);
      setError("Failed to generate content. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="font-display text-xl">Generate {resourceKindLabel}</CardTitle>
          <CardDescription>
            Describe what you want to generate. Inkling uses the selected source + student context to
            personalize it, then saves it to your Living Library.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="prompt" className="font-body">
                Your Instructions
              </Label>
              <textarea
                id="prompt"
                value={userPrompt}
                onChange={(e) => setUserPrompt(e.target.value)}
                placeholder="e.g., Create a quiz about fractions with 10 questions..."
                className="mt-2 w-full min-h-[150px] rounded-qc-md border border-qc-border-subtle px-3 py-2 font-body text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-qc-primary focus-visible:ring-offset-2"
                disabled={isGenerating}
              />
            </div>

            {contextParams.studentId && (
              <div className="p-3 bg-qc-primary/5 rounded-qc-md border border-qc-primary/20">
                <p className="font-body text-xs text-qc-text-muted">
                  This content will be personalized for the selected student
                </p>
              </div>
            )}

            <Button type="submit" disabled={isGenerating || !userPrompt.trim()} className="w-full">
              {isGenerating ? "Generating..." : "Generate Content"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {error && (
        <Card>
          <CardContent className="py-4">
            <p className="font-body text-sm text-red-600">{error}</p>
          </CardContent>
        </Card>
      )}

      {resultId && (
        <Card>
          <CardContent className="py-6 text-center space-y-3">
            <p className="font-body text-qc-charcoal">✓ Generated and saved to your Living Library.</p>
            <Link
              href="/living-library"
              className="inline-flex items-center justify-center rounded-qc-md border border-qc-border-subtle px-4 py-2 font-body text-sm text-qc-primary hover:bg-qc-primary/10 transition-colors"
            >
              View it in the Living Library
            </Link>
          </CardContent>
        </Card>
      )}

      {isGenerating && (
        <Card>
          <CardContent className="py-12 text-center">
            <div className="flex flex-col items-center gap-4">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-qc-border-subtle border-t-qc-primary"></div>
              <p className="font-body text-qc-text-muted">Generating personalized content...</p>
              <p className="font-body text-xs text-qc-text-muted">
                Using the selected source, student profile, and family blueprint
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

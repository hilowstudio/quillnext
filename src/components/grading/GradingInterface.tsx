"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { generateItemFeedback, generateOverallFeedback } from "@/app/actions/grading-actions";

interface GradingInterfaceProps {
  attempt: any;
  personalityData: any;
}

export function GradingInterface({
  attempt,
  personalityData,
}: GradingInterfaceProps) {
  const router = useRouter();
  const [scores, setScores] = useState<Record<string, number>>({});
  const [feedback, setFeedback] = useState<Record<string, string>>({});
  const [isGeneratingFeedback, setIsGeneratingFeedback] = useState<string | null>(null);
  const [overallFeedback, setOverallFeedback] = useState("");
  const [isGeneratingOverall, setIsGeneratingOverall] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleScoreChange = (itemId: string, value: string) => {
    const numValue = parseFloat(value) || 0;
    const maxPoints = Number(attempt.assessment.items.find((i: any) => i.id === itemId)?.points || 0);
    setScores({ ...scores, [itemId]: Math.min(numValue, maxPoints) });
  };

  const handleGenerateFeedback = async (itemId: string, responseId: string) => {
    setIsGeneratingFeedback(itemId);
    try {
      const item = attempt.assessment.items.find((i: any) => i.id === itemId);
      const response = attempt.itemResponses.find((r: any) => r.id === responseId);

      if (!item || !response) return;

      const { text } = await generateItemFeedback({
        studentId: attempt.studentId,
        courseId: attempt.assessment.courseId,
        questionText: item.questionText,
        responseContent: response.responseData,
      });

      setFeedback({ ...feedback, [itemId]: text });
    } catch (error) {
      console.error("Failed to generate feedback:", error);
      toast.error("Failed to generate feedback. Please try again.");
    } finally {
      setIsGeneratingFeedback(null);
    }
  };

  const handleGenerateOverallFeedback = async () => {
    setIsGeneratingOverall(true);
    try {
      const totalScore = Object.values(scores).reduce((sum, score) => sum + score, 0);
      const maxScore = attempt.assessment.items.reduce(
        (sum: number, item: any) => sum + Number(item.points || 0),
        0,
      );

      const { text } = await generateOverallFeedback({
        studentId: attempt.studentId,
        courseId: attempt.assessment.courseId,
        assessmentTitle: attempt.assessment.title,
        totalScore,
        maxScore,
      });

      setOverallFeedback(text);
    } catch (error) {
      console.error("Failed to generate overall feedback:", error);
      toast.error("Failed to generate overall feedback. Please try again.");
    } finally {
      setIsGeneratingOverall(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Q-18-004 — label the grade honestly: AI_ASSISTED only when Inkling feedback was
      // actually generated this session (per-item or overall), otherwise MANUAL. The server
      // recomputes scorePoints/maxPoints authoritatively from the item points, so the client
      // no longer sends (and the server no longer trusts) the totals.
      const usedAI = Object.keys(feedback).length > 0 || overallFeedback.trim().length > 0;

      const response = await fetch(`/api/grading/${attempt.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          feedback: overallFeedback,
          itemScores: scores,
          itemFeedback: feedback,
          gradingMethod: usedAI ? "AI_ASSISTED" : "MANUAL",
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to save grades");
      }

      toast.success("Grades saved successfully!");
      router.refresh();
    } catch (error) {
      console.error("Failed to save grades:", error);
      toast.error("Failed to save grades. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Assessment Items */}
      <Card>
        <CardHeader>
          <CardTitle className="font-display text-xl">Assessment Items</CardTitle>
          <CardDescription>
            Grade each response. Inkling will help generate personalized feedback.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {attempt.assessment.items.map((item: any) => {
            const response = attempt.itemResponses.find((r: any) => r.itemId === item.id);
            const currentScore = scores[item.id] ?? Number(response?.pointsEarned || 0);
            const currentFeedback = feedback[item.id] || response?.feedback || "";

            return (
              <div key={item.id} className="p-4 bg-qc-parchment rounded-qc-md border border-qc-border-subtle">
                <div className="mb-3">
                  <p className="font-body font-medium text-qc-charcoal mb-2">
                    {item.position}. {item.questionText}
                  </p>
                  <p className="font-body text-xs text-qc-text-muted">
                    {item.itemType} • {Number(item.points)} points
                  </p>
                </div>

                {response && (
                  <div className="mb-3 p-3 bg-qc-warm-stone rounded-qc-md">
                    <p className="font-body text-xs font-medium text-qc-text-muted mb-1">
                      Student Response:
                    </p>
                    <p className="font-body text-sm text-qc-charcoal">
                      {typeof response.responseData === "string"
                        ? response.responseData
                        : JSON.stringify(response.responseData)}
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4 mb-3">
                  <div>
                    <Label htmlFor={`score-${item.id}`} className="font-body text-sm">
                      Score (0 - {Number(item.points)})
                    </Label>
                    <Input
                      id={`score-${item.id}`}
                      type="number"
                      min="0"
                      max={Number(item.points)}
                      value={currentScore}
                      onChange={(e) => handleScoreChange(item.id, e.target.value)}
                      className="mt-2"
                    />
                  </div>
                  <div className="flex items-end">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => response && handleGenerateFeedback(item.id, response.id)}
                      disabled={!response || isGeneratingFeedback === item.id}
                    >
                      {isGeneratingFeedback === item.id
                        ? "Generating..."
                        : "Generate Inkling Feedback"}
                    </Button>
                  </div>
                </div>

                {currentFeedback && (
                  <div className="p-3 bg-qc-primary/5 rounded-qc-md border border-qc-primary/20">
                    <p className="font-body text-xs font-medium text-qc-primary mb-1">
                      Personalized Feedback:
                    </p>
                    <p className="font-body text-sm text-qc-charcoal whitespace-pre-wrap">
                      {currentFeedback}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Overall Feedback */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="font-display text-xl">Overall Feedback</CardTitle>
              <CardDescription>
                Inkling-generated personalized feedback using student's profile
              </CardDescription>
            </div>
            <Button
              variant="outline"
              onClick={handleGenerateOverallFeedback}
              disabled={isGeneratingOverall}
            >
              {isGeneratingOverall ? "Generating..." : "Generate Overall Feedback"}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {overallFeedback ? (
            <div className="p-4 bg-qc-primary/5 rounded-qc-md border border-qc-primary/20">
              <p className="font-body text-sm text-qc-charcoal whitespace-pre-wrap">
                {overallFeedback}
              </p>
            </div>
          ) : (
            <p className="font-body text-sm text-qc-text-muted text-center py-4">
              Click "Generate Overall Feedback" to create personalized feedback using the
              student's learning profile.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isSaving} size="lg">
          {isSaving ? "Saving..." : "Save Grades"}
        </Button>
      </div>
    </div>
  );
}


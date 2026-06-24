import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface PersonalityProfileProps {
    studentId: string;
    personalityData: any;
}

export function PersonalityProfile({ studentId, personalityData }: PersonalityProfileProps) {
    return (
        <Card>
            <CardHeader>
                <CardTitle className="font-display text-xl">Personality Profile</CardTitle>
                <CardDescription>Inkling-generated learning profile</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {personalityData ? (
                    <>
                        {personalityData.motivationalDriver && (
                            <div>
                                <p className="font-body text-sm font-medium text-qc-text-muted mb-1">
                                    Motivational Driver
                                </p>
                                <span className="px-3 py-1 bg-qc-primary/10 text-qc-primary rounded-full text-sm font-body font-medium">
                                    {personalityData.motivationalDriver}
                                </span>
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-4">
                            {personalityData.feedbackStyle && (
                                <div>
                                    <p className="font-body text-sm font-medium text-qc-text-muted mb-1">
                                        Feedback Style
                                    </p>
                                    <p className="font-body text-qc-charcoal">
                                        {personalityData.feedbackStyle}
                                    </p>
                                </div>
                            )}
                            {personalityData.scaffoldingLevel && (
                                <div>
                                    <p className="font-body text-sm font-medium text-qc-text-muted mb-1">
                                        Scaffolding Level
                                    </p>
                                    <p className="font-body text-qc-charcoal">
                                        {personalityData.scaffoldingLevel}
                                    </p>
                                </div>
                            )}
                        </div>

                        {personalityData.toneInstructions && (
                            <div>
                                <p className="font-body text-sm font-medium text-qc-text-muted mb-2">
                                    Inkling Persona Instructions
                                </p>
                                <div className="bg-qc-warm-stone rounded-qc-md p-3">
                                    <p className="font-body text-sm text-qc-charcoal italic">
                                        &quot;{personalityData.toneInstructions}&quot;
                                    </p>
                                </div>
                            </div>
                        )}

                        <Button variant="outline" size="sm" asChild>
                            <Link href={`/students/${studentId}/assessment`}>Update Assessment</Link>
                        </Button>
                    </>
                ) : (
                    <div className="text-center py-8">
                        <p className="font-body text-qc-text-muted mb-4">
                            No personality profile yet. Complete the assessment to enable Inkling personalization.
                        </p>
                        <Button asChild>
                            <Link href={`/students/${studentId}/assessment`}>Start Assessment</Link>
                        </Button>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

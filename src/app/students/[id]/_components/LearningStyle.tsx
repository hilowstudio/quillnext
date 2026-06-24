import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

interface LearningStyleProps {
    learningStyleData: any;
}

export function LearningStyle({ learningStyleData }: LearningStyleProps) {
    return (
        <Card>
            <CardHeader>
                <CardTitle className="font-display text-xl">Learning Style</CardTitle>
                <CardDescription>Cognitive preferences and input modes</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {learningStyleData ? (
                    <>
                        <div className="grid grid-cols-2 gap-4">
                            {learningStyleData.inputMode && (
                                <div>
                                    <p className="font-body text-sm font-medium text-qc-text-muted mb-1">
                                        Input Mode
                                    </p>
                                    <p className="font-body text-qc-charcoal">
                                        {learningStyleData.inputMode}
                                    </p>
                                </div>
                            )}
                            {learningStyleData.outputMode && (
                                <div>
                                    <p className="font-body text-sm font-medium text-qc-text-muted mb-1">
                                        Output Mode
                                    </p>
                                    <p className="font-body text-qc-charcoal">
                                        {learningStyleData.outputMode}
                                    </p>
                                </div>
                            )}
                        </div>

                        {learningStyleData.processingMode && (
                            <div>
                                <p className="font-body text-sm font-medium text-qc-text-muted mb-1">
                                    Processing Style
                                </p>
                                <p className="font-body text-qc-charcoal">
                                    {learningStyleData.processingMode}
                                </p>
                            </div>
                        )}

                        {learningStyleData.formatInstructions && (
                            <div>
                                <p className="font-body text-sm font-medium text-qc-text-muted mb-2">
                                    Formatting Rules
                                </p>
                                <div className="bg-qc-warm-stone rounded-qc-md p-3">
                                    <p className="font-body text-sm text-qc-charcoal italic">
                                        &quot;{learningStyleData.formatInstructions}&quot;
                                    </p>
                                </div>
                            </div>
                        )}
                    </>
                ) : (
                    <div className="text-center py-8">
                        <p className="font-body text-qc-text-muted">
                            Learning style assessment not yet completed.
                        </p>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

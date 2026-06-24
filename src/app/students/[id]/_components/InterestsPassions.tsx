import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import type { InterestsData } from "@/lib/students/learner-profile";

interface InterestsPassionsProps {
    interestsData: InterestsData | null;
}

export function InterestsPassions({ interestsData }: InterestsPassionsProps) {
    return (
        <Card className="lg:col-span-2">
            <CardHeader>
                <CardTitle className="font-display text-xl">Interests & Passions</CardTitle>
                <CardDescription>Contextual hooks for engagement</CardDescription>
            </CardHeader>
            <CardContent>
                {interestsData ? (
                    <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <p className="font-body text-sm font-medium text-qc-text-muted mb-2">
                                    Hook Themes (Worlds)
                                </p>
                                <div className="flex flex-wrap gap-2">
                                    {interestsData.hookThemes?.map((theme: string, idx: number) => (
                                        <span key={idx} className="px-3 py-1 bg-qc-accent/10 text-qc-accent rounded-full text-sm font-body">
                                            {theme}
                                        </span>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <p className="font-body text-sm font-medium text-qc-text-muted mb-2">
                                    Specific Favorites
                                </p>
                                {interestsData.specificEntities && interestsData.specificEntities.length > 0 ? (
                                    <div className="grid grid-cols-2 gap-2">
                                        {interestsData.specificEntities.map((entity, idx) => (
                                            <div key={idx} className="bg-qc-parchment p-2 rounded-qc-sm border border-qc-border-subtle">
                                                <p className="text-xs text-qc-text-muted">{entity.category}</p>
                                                <p className="text-sm font-medium text-qc-charcoal">{entity.favorite}</p>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-sm text-qc-text-muted italic">No favorites listed.</p>
                                )}
                            </div>
                        </div>

                        {interestsData.analogyStrategy && (
                            <div>
                                <p className="font-body text-sm font-medium text-qc-text-muted mb-2">
                                    Analogy Strategy
                                </p>
                                <div className="bg-qc-warm-stone rounded-qc-md p-3">
                                    <p className="font-body text-sm text-qc-charcoal">
                                        {interestsData.analogyStrategy}
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="text-center py-8">
                        <p className="font-body text-qc-text-muted">
                            Interests assessment not yet completed.
                        </p>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { ObjectiveWithRelations } from "@/server/queries/students";

interface CurrentObjectivesProps {
    studentId: string;
    objectives: ObjectiveWithRelations[];
}

export function CurrentObjectives({ studentId, objectives }: CurrentObjectivesProps) {
    if (objectives.length === 0) {
        return null;
    }

    return (
        <Card className="mb-8">
            <CardHeader>
                <CardTitle className="font-display text-xl">Current Learning Objectives</CardTitle>
                <CardDescription>
                    Objectives from enrolled courses that this student is working on
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="space-y-3">
                    {objectives.slice(0, 10).map((objective) => (
                        <div
                            key={objective.id}
                            className="p-3 bg-qc-parchment rounded-qc-md border border-qc-border-subtle"
                        >
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex-1">
                                    <p className="font-body text-xs text-qc-text-muted mb-1">
                                        {objective.subtopic.topic.strand.subject.name} &gt;{" "}
                                        {objective.subtopic.topic.strand.name} &gt; {objective.subtopic.topic.name}
                                    </p>
                                    <p className="font-body text-sm text-qc-charcoal">{objective.text}</p>
                                    <p className="font-body text-xs text-qc-text-muted mt-1">
                                        Code: {objective.code}
                                    </p>
                                </div>
                                <Button variant="outline" size="sm" asChild>
                                    <Link href={`/creation-station?studentId=${studentId}&objectiveId=${objective.id}`}>
                                        Generate
                                    </Link>
                                </Button>
                            </div>
                        </div>
                    ))}
                    {objectives.length > 10 && (
                        <p className="font-body text-xs text-qc-text-muted text-center">
                            Showing 10 of {objectives.length} objectives
                        </p>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}

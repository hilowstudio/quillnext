import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ContextBadges } from "@/components/context/ContextBadges";
import type { StudentWithRelations } from "@/server/queries/students";

interface StudentHeaderProps {
    student: StudentWithRelations;
}

export function StudentHeader({ student }: StudentHeaderProps) {
    const personalityData = student.learnerProfile?.personalityData;

    return (
        <div className="mb-8">
            <div className="flex items-center justify-between mb-3">
                <div>
                    <h1 className="font-display text-4xl font-bold text-qc-charcoal mb-2 text-balance">
                        {student.preferredName || student.firstName} {student.lastName}
                    </h1>
                    <p className="font-body text-qc-text-muted">
                        Grade {student.currentGrade}
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button asChild>
                        <Link href={`/creation-station?studentId=${student.id}`}>
                            Generate Content for {student.preferredName || student.firstName}
                        </Link>
                    </Button>
                    {!personalityData && (
                        <Button variant="outline" asChild>
                            <Link href={`/students/${student.id}/assessment`}>Start Assessment</Link>
                        </Button>
                    )}
                    <Button variant="outline" asChild>
                        <Link href="/students">Back to Students</Link>
                    </Button>
                </div>
            </div>
            <div className="mb-4">
                <ContextBadges student={student} />
            </div>
        </div>
    );
}

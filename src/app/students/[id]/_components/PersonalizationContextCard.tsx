import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import type { StudentWithRelations, BookWithRelations } from "@/server/queries/students";

interface PersonalizationContextCardProps {
    student: StudentWithRelations;
    relevantBooks: BookWithRelations[];
}

// Student-detail "Personalization Context" card. Renamed from `ContextCompleteness` to avoid a
// name collision with the org-level src/components/context/ContextCompleteness.tsx (different props
// and a different 5-pillar scoring algorithm). This is the student-scoped 4-item heuristic score.
export function PersonalizationContextCard({ student, relevantBooks }: PersonalizationContextCardProps) {
    const personalityData = student.learnerProfile?.personalityData as any;
    const learningStyleData = student.learnerProfile?.learningStyleData as any;

    const contextCompleteness = {
        profile: !!personalityData,
        learningStyle: !!learningStyleData,
        courses: student.courseEnrollments.length > 0,
        books: relevantBooks.length > 0,
    };

    const completenessScore = Math.round(
        (Object.values(contextCompleteness).filter(Boolean).length /
            Object.keys(contextCompleteness).length) *
        100,
    );

    return (
        <Card className="mb-8">
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="font-display text-xl">Personalization Context</CardTitle>
                        <CardDescription>How complete is this student's profile?</CardDescription>
                    </div>
                    <div className="text-right">
                        <div className="font-display text-3xl font-bold text-qc-primary">
                            {completenessScore}%
                        </div>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <div className="space-y-2">
                    <div className="flex items-center justify-between p-2 rounded-qc-md bg-qc-parchment">
                        <span className="font-body text-sm text-qc-charcoal">Personality Profile</span>
                        <span className={`font-body text-xs ${contextCompleteness.profile ? "text-qc-success" : "text-qc-text-muted"}`}>
                            {contextCompleteness.profile ? "✓ Complete" : "○ Missing"}
                        </span>
                    </div>
                    <div className="flex items-center justify-between p-2 rounded-qc-md bg-qc-parchment">
                        <span className="font-body text-sm text-qc-charcoal">Learning Style</span>
                        <span className={`font-body text-xs ${contextCompleteness.learningStyle ? "text-qc-success" : "text-qc-text-muted"}`}>
                            {contextCompleteness.learningStyle ? "✓ Complete" : "○ Missing"}
                        </span>
                    </div>
                    <div className="flex items-center justify-between p-2 rounded-qc-md bg-qc-parchment">
                        <span className="font-body text-sm text-qc-charcoal">Enrolled Courses</span>
                        <span className={`font-body text-xs ${contextCompleteness.courses ? "text-qc-success" : "text-qc-text-muted"}`}>
                            {contextCompleteness.courses
                                ? `${student.courseEnrollments.length} course${student.courseEnrollments.length !== 1 ? "s" : ""}`
                                : "○ No courses"}
                        </span>
                    </div>
                    <div className="flex items-center justify-between p-2 rounded-qc-md bg-qc-parchment">
                        <span className="font-body text-sm text-qc-charcoal">Relevant Books</span>
                        <span className={`font-body text-xs ${contextCompleteness.books ? "text-qc-success" : "text-qc-text-muted"}`}>
                            {contextCompleteness.books
                                ? `${relevantBooks.length} book${relevantBooks.length !== 1 ? "s" : ""}`
                                : "○ No books"}
                        </span>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

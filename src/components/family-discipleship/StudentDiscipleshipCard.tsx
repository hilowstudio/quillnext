import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface StudentDiscipleshipCardProps {
    studentId: string;
    studentName: string;
    className?: string;
}

export function StudentDiscipleshipCard({ studentId, studentName, className }: StudentDiscipleshipCardProps) {
    return (
        <Card className={className}>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="font-display text-xl">Family Discipleship</CardTitle>
                        <CardDescription>Faith nurturing tools tailored for {studentName}</CardDescription>
                    </div>
                    <Button asChild>
                        <Link href={`/students/${studentId}/family-discipleship`}>
                            Open Suite
                        </Link>
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <Link href={`/students/${studentId}/family-discipleship/catechism`} className="block p-3 bg-qc-parchment rounded-qc-md border border-qc-border-subtle hover:border-qc-primary/50 transition-colors text-center">
                        <span className="font-display font-bold text-qc-primary block mb-1">Catechism</span>
                        <span className="text-xs text-qc-text-muted">Study Now</span>
                    </Link>
                    <Link href={`/family-discipleship/bible-memory`} className="block p-3 bg-qc-parchment rounded-qc-md border border-qc-border-subtle hover:border-qc-primary/50 transition-colors text-center">
                        <span className="font-display font-bold text-qc-primary block mb-1">Memory</span>
                        <span className="text-xs text-qc-text-muted">Review Verses</span>
                    </Link>
                    <Link href={`/family-discipleship/prayer`} className="block p-3 bg-qc-parchment rounded-qc-md border border-qc-border-subtle hover:border-qc-primary/50 transition-colors text-center">
                        <span className="font-display font-bold text-qc-primary block mb-1">Prayer</span>
                        <span className="text-xs text-qc-text-muted">Journal</span>
                    </Link>
                    <Link href={`/family-discipleship/devotionals`} className="block p-3 bg-qc-parchment rounded-qc-md border border-qc-border-subtle hover:border-qc-primary/50 transition-colors text-center">
                        <span className="font-display font-bold text-qc-primary block mb-1">Devotionals</span>
                        <span className="text-xs text-qc-text-muted">Read Today</span>
                    </Link>
                </div>
            </CardContent>
        </Card>
    );
}

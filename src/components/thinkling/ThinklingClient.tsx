"use client";

import { useState } from "react";
import { ThinklingMode } from "@/lib/thinkling";
import { ThinklingChat } from "@/components/thinkling/ThinklingChat";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Lightbulb } from "@phosphor-icons/react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface Student {
    id: string;
    preferredName: string | null;
    firstName: string;
    lastName: string | null;
}

interface ThinklingClientProps {
    students: Student[];
}

export function ThinklingClient({ students }: ThinklingClientProps) {
    const [selectedStudentId, setSelectedStudentId] = useState<string>(students[0]?.id || "");
    const [mode, setMode] = useState<ThinklingMode>("TUTOR");

    if (students.length === 0) {
        return (
            <div className="container mx-auto max-w-5xl px-4 py-8 text-center">
                <Card>
                    <CardContent className="py-12">
                        <h2 className="text-xl font-bold text-qc-charcoal">No Students Found</h2>
                        <p className="text-qc-text-muted mt-2">Please add a student to start using Thinkling.</p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="container mx-auto max-w-6xl px-4 py-8 space-y-8 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="font-display text-4xl font-bold text-qc-charcoal mb-2 flex items-center gap-3 text-balance">
                        <Avatar className="h-12 w-12 rounded-none border-0">
                            <AvatarImage src="/assets/branding/Inkling.png" alt="Thinkling" />
                            <AvatarFallback><Lightbulb weight="duotone" className="text-qc-primary" /></AvatarFallback>
                        </Avatar>
                        Thinkling
                    </h1>
                    <p className="font-body text-qc-text-muted qc-prose">
                        Inkling, supercharged. Interact with your personalized assistant in three distinct modes.
                    </p>
                </div>

                <div className="w-full md:w-64">
                    <Select value={selectedStudentId} onValueChange={setSelectedStudentId}>
                        <SelectTrigger className="bg-white">
                            <SelectValue placeholder="Select Student" />
                        </SelectTrigger>
                        <SelectContent>
                            {students.map((s) => (
                                <SelectItem key={s.id} value={s.id}>
                                    {s.preferredName || s.firstName} {s.lastName}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* Chat Interface */}
            <section>
                <ThinklingChat key={selectedStudentId} studentId={selectedStudentId} mode={mode} onModeChange={setMode} />
            </section>
        </div>
    );
}

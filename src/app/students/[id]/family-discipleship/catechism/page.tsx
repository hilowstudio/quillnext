import React from 'react';
import { CatechismManager } from "@/app/family-discipleship/catechism/CatechismManager";

export default async function StudentCatechismPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;

    return (
        <div className="container mx-auto p-6">
            <div className="mb-6">
                <h1 className="text-3xl font-bold text-qc-primary font-display text-balance">Student Catechism</h1>
                <p className="text-qc-text-muted">Tracking progress for this student</p>
            </div>
            <CatechismManager studentId={id} />
        </div>
    );
}

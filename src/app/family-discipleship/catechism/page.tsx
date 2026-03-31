import React from 'react';
import { CatechismManager } from "./CatechismManager";

export default function CatechismPage() {
    return (
        <div className="container mx-auto p-4 md:p-6 space-y-8">
            <div className="flex flex-col gap-2">
                <h1 className="font-display text-4xl font-bold text-qc-primary text-balance">Catechism Study</h1>
                <p className="font-body text-lg text-qc-text-muted">A system for learning biblical truth.</p>
            </div>
            <CatechismManager />
        </div>
    );
}

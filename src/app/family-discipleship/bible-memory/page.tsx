import React from 'react';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { getCurrentUserOrg } from '@/lib/auth-helpers';
import { db } from "@/server/db";
import { getLibraryVerses, getUserVerses, getStudentFolders } from './actions';
import BibleMemoryDashboard from './BibleMemoryDashboard';

export default async function BibleMemoryPage({
    searchParams,
}: {
    searchParams: Promise<{ studentId?: string }>;
}) {
    // SECURITY: require a session and only ever resolve a student that belongs to the
    // caller's org. Previously this did a global `db.student.findFirst()` ("first student
    // for demo purposes"), leaking an arbitrary cross-tenant student into the UI.
    const session = await auth();
    if (!session?.user) {
        redirect('/login');
    }

    const { organizationId } = await getCurrentUserOrg(session);
    if (!organizationId) {
        redirect('/onboarding');
    }

    const { studentId: requestedStudentId } = await searchParams;

    // Honor ?studentId only if it belongs to this org; otherwise fall back to the org's
    // first student.
    let student = requestedStudentId
        ? await db.student.findFirst({ where: { id: requestedStudentId, organizationId } })
        : null;
    if (!student) {
        student = await db.student.findFirst({ where: { organizationId } });
    }
    const studentId = student?.id || "";

    if (!studentId) {
        return (
            <div className="container mx-auto p-6 text-center">
                <h1 className="text-2xl font-bold text-red-600 mb-4">No Student Found</h1>
                <p>Please seed the database or create a student to use this tool.</p>
            </div>
        );
    }

    const [userVerses, libraryVerses, folders] = await Promise.all([
        getUserVerses(studentId),
        getLibraryVerses(),
        getStudentFolders(studentId)
    ]);

    return (
        <div className="container mx-auto p-4 md:p-6 space-y-8">
            <div className="flex flex-col gap-2">
                <h1 className="font-display text-4xl font-bold text-qc-primary text-balance">Scripture Memory</h1>
                <p className="font-body text-lg text-qc-text-muted">Hide God&apos;s word in your heart.</p>
            </div>
            <BibleMemoryDashboard
                initialUserVerses={userVerses}
                libraryVerses={libraryVerses}
                studentId={studentId}
                folders={folders}
            />
        </div>
    );
}

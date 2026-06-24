"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { assignResourceToStudent } from "@/app/actions/assignments";
import { SpinnerGap, Plus, UserPlus } from "@phosphor-icons/react";

interface AssignResourceDialogProps {
    resourceId: string;
    resourceTitle: string;
    type?: 'RESOURCE' | 'COURSE';
    students: { id: string; firstName: string; preferredName: string | null }[];
    trigger?: React.ReactNode;
}

export function AssignResourceDialog({ resourceId, resourceTitle, type = 'RESOURCE', students, trigger }: AssignResourceDialogProps) {
    const [open, setOpen] = useState(false);
    const [selectedStudentId, setSelectedStudentId] = useState("");
    const [loading, setLoading] = useState(false);

    const handleAssign = async () => {
        if (!selectedStudentId) return;
        setLoading(true);
        try {
            await assignResourceToStudent(resourceId, selectedStudentId, type);
            setOpen(false);
            setSelectedStudentId("");
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {trigger || (
                    <Button variant="ghost" size="icon" title="Assign to Student">
                        <UserPlus size={16} className="text-qc-text-muted hover:text-qc-primary" />
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Assign {type === 'COURSE' ? 'Course' : 'Resource'}</DialogTitle>
                </DialogHeader>
                <div className="py-4 space-y-4">
                    <p className="text-sm text-qc-text-muted">
                        Assign <strong>{resourceTitle}</strong> to a student. They will see it on their dashboard.
                    </p>
                    <Select value={selectedStudentId} onValueChange={setSelectedStudentId}>
                        <SelectTrigger>
                            <SelectValue placeholder="Select a student" />
                        </SelectTrigger>
                        <SelectContent>
                            {students.map((s) => (
                                <SelectItem key={s.id} value={s.id}>
                                    {s.preferredName || s.firstName}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                    <Button onClick={handleAssign} disabled={!selectedStudentId || loading}>
                        {loading && <SpinnerGap size={16} className="mr-2 animate-spin" />}
                        Assign
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

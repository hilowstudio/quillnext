"use client";

import { useEffect, useState } from "react";
import { Label } from "@/components/ui/label";
import {
    getSubjects,
    getStrands,
    getTopics,
    getSubtopics,
    getObjectives,
} from "@/app/actions/spine-actions";

/** The deepest spine node the parent has selected — what generation targets. */
export interface SpineSelection {
    level: "SUBJECT" | "STRAND" | "TOPIC_NODE" | "SUBTOPIC" | "OBJECTIVE";
    id: string;
    name: string;
    subjectName: string;
}

type Node = { id: string; name: string };

/** The deepest non-empty selection becomes the generation target (generate at ANY level). */
function deepest(sel: {
    subject?: Node;
    strand?: Node;
    topic?: Node;
    subtopic?: Node;
    objective?: Node;
}): SpineSelection | null {
    const subjectName = sel.subject?.name ?? "";
    if (sel.objective) return { level: "OBJECTIVE", id: sel.objective.id, name: sel.objective.name, subjectName };
    if (sel.subtopic) return { level: "SUBTOPIC", id: sel.subtopic.id, name: sel.subtopic.name, subjectName };
    if (sel.topic) return { level: "TOPIC_NODE", id: sel.topic.id, name: sel.topic.name, subjectName };
    if (sel.strand) return { level: "STRAND", id: sel.strand.id, name: sel.strand.name, subjectName };
    if (sel.subject) return { level: "SUBJECT", id: sel.subject.id, name: sel.subject.name, subjectName };
    return null;
}

const SELECT_CLASS =
    "flex h-10 w-full rounded-qc-md border border-qc-border-subtle bg-white px-3 py-2 font-body text-sm text-qc-charcoal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-qc-primary focus-visible:ring-offset-2 disabled:opacity-50";

const LEVEL_LABEL: Record<SpineSelection["level"], string> = {
    SUBJECT: "Subject",
    STRAND: "Strand",
    TOPIC_NODE: "Topic",
    SUBTOPIC: "Subtopic",
    OBJECTIVE: "Objective",
};

/**
 * Cascading academic-spine browser: Subject → Strand → Topic → Subtopic → Objective. The parent can
 * stop at ANY level; the deepest selected node is reported via onSelect and becomes the generation
 * target (spine-driven generation works at every level). Reuses the existing spine server actions.
 */
export function SpineBrowser({ onSelect }: { onSelect: (sel: SpineSelection | null) => void }) {
    const [subjects, setSubjects] = useState<Node[]>([]);
    const [strands, setStrands] = useState<Node[]>([]);
    const [topics, setTopics] = useState<Node[]>([]);
    const [subtopics, setSubtopics] = useState<Node[]>([]);
    const [objectives, setObjectives] = useState<Node[]>([]);
    const [sel, setSel] = useState<{
        subject?: Node;
        strand?: Node;
        topic?: Node;
        subtopic?: Node;
        objective?: Node;
    }>({});

    useEffect(() => {
        getSubjects()
            .then((r) => setSubjects(r.subjects.map((s) => ({ id: s.id, name: s.name }))))
            .catch(() => {});
    }, []);

    const update = (next: typeof sel) => {
        setSel(next);
        onSelect(deepest(next));
    };

    const onSubject = async (id: string) => {
        const node = subjects.find((n) => n.id === id);
        setStrands([]);
        setTopics([]);
        setSubtopics([]);
        setObjectives([]);
        update({ subject: node });
        if (node) {
            try {
                const r = await getStrands({ subjectId: id });
                setStrands(r.strands.map((x) => ({ id: x.id, name: x.name })));
            } catch {
                /* ignore */
            }
        }
    };

    const onStrand = async (id: string) => {
        const node = strands.find((n) => n.id === id);
        setTopics([]);
        setSubtopics([]);
        setObjectives([]);
        update({ subject: sel.subject, strand: node });
        if (node) {
            try {
                const r = await getTopics({ strandId: id });
                setTopics(r.topics.map((x) => ({ id: x.id, name: x.name })));
            } catch {
                /* ignore */
            }
        }
    };

    const onTopic = async (id: string) => {
        const node = topics.find((n) => n.id === id);
        setSubtopics([]);
        setObjectives([]);
        update({ subject: sel.subject, strand: sel.strand, topic: node });
        if (node) {
            try {
                const r = await getSubtopics({ topicId: id });
                setSubtopics(r.subtopics.map((x) => ({ id: x.id, name: x.name })));
            } catch {
                /* ignore */
            }
        }
    };

    const onSubtopic = async (id: string) => {
        const node = subtopics.find((n) => n.id === id);
        setObjectives([]);
        update({ subject: sel.subject, strand: sel.strand, topic: sel.topic, subtopic: node });
        if (node) {
            try {
                const r = await getObjectives({ subtopicId: id });
                setObjectives(r.objectives.map((x) => ({ id: x.id, name: x.text })));
            } catch {
                /* ignore */
            }
        }
    };

    const onObjective = (id: string) => {
        const node = objectives.find((n) => n.id === id);
        update({
            subject: sel.subject,
            strand: sel.strand,
            topic: sel.topic,
            subtopic: sel.subtopic,
            objective: node,
        });
    };

    const target = deepest(sel);

    return (
        <div className="space-y-3">
            <div className="space-y-1.5">
                <Label className="text-xs">Subject</Label>
                <select className={SELECT_CLASS} value={sel.subject?.id ?? ""} onChange={(e) => onSubject(e.target.value)}>
                    <option value="">Select a subject…</option>
                    {subjects.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                </select>
            </div>

            {strands.length > 0 && (
                <div className="space-y-1.5">
                    <Label className="text-xs">Strand</Label>
                    <select className={SELECT_CLASS} value={sel.strand?.id ?? ""} onChange={(e) => onStrand(e.target.value)}>
                        <option value="">All of this subject…</option>
                        {strands.map((s) => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                    </select>
                </div>
            )}

            {topics.length > 0 && (
                <div className="space-y-1.5">
                    <Label className="text-xs">Topic</Label>
                    <select className={SELECT_CLASS} value={sel.topic?.id ?? ""} onChange={(e) => onTopic(e.target.value)}>
                        <option value="">All of this strand…</option>
                        {topics.map((s) => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                    </select>
                </div>
            )}

            {subtopics.length > 0 && (
                <div className="space-y-1.5">
                    <Label className="text-xs">Subtopic</Label>
                    <select className={SELECT_CLASS} value={sel.subtopic?.id ?? ""} onChange={(e) => onSubtopic(e.target.value)}>
                        <option value="">All of this topic…</option>
                        {subtopics.map((s) => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                    </select>
                </div>
            )}

            {objectives.length > 0 && (
                <div className="space-y-1.5">
                    <Label className="text-xs">Objective</Label>
                    <select className={SELECT_CLASS} value={sel.objective?.id ?? ""} onChange={(e) => onObjective(e.target.value)}>
                        <option value="">All of this subtopic…</option>
                        {objectives.map((s) => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                    </select>
                </div>
            )}

            {target && (
                <p className="font-body text-xs text-qc-text-muted pt-1">
                    Generating for <span className="font-semibold text-qc-charcoal">{LEVEL_LABEL[target.level]}</span>:{" "}
                    {target.name}
                </p>
            )}
        </div>
    );
}

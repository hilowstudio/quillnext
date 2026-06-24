"use client";

import { useState, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { getSubjects, getStrands, getTopics, getSubtopics, getObjectives } from "@/app/actions/spine-actions";

interface TopicSelectorProps {
    onTopicChange: (topic: string, metadata?: any) => void;
}

export function TopicSelector({ onTopicChange }: TopicSelectorProps) {
    const [mode, setMode] = useState<"SPINE" | "FREE" | "STANDARD">("SPINE");

    // Spine State
    const [subjects, setSubjects] = useState<any[]>([]);
    const [strands, setStrands] = useState<any[]>([]);
    const [topics, setTopics] = useState<any[]>([]);
    const [subtopics, setSubtopics] = useState<any[]>([]);
    const [objectives, setObjectives] = useState<any[]>([]);

    const [selectedSubject, setSelectedSubject] = useState("");
    const [selectedStrand, setSelectedStrand] = useState("");
    const [selectedTopic, setSelectedTopic] = useState("");
    const [selectedSubtopic, setSelectedSubtopic] = useState("");
    const [selectedObjective, setSelectedObjective] = useState("");

    const [freeText, setFreeText] = useState("");
    const [standardCode, setStandardCode] = useState("");

    useEffect(() => {
        getSubjects().then(res => res.success && setSubjects(res.subjects || []));
    }, []);

    // Fetch the next spine level when a selection changes (setState lives in the async .then,
    // which set-state-in-effect allows). The downstream RESETS are not here — clearing stale
    // child selections is a reaction to the user picking a level, so it lives in the
    // onValueChange handlers below (effect-as-event → move to the handler).
    useEffect(() => {
        if (selectedSubject) {
            getStrands({ subjectId: selectedSubject }).then(res => res.success && setStrands(res.strands || []));
        }
    }, [selectedSubject]);

    useEffect(() => {
        if (selectedStrand) {
            getTopics({ strandId: selectedStrand }).then(res => res.success && setTopics(res.topics || []));
        }
    }, [selectedStrand]);

    useEffect(() => {
        if (selectedTopic) {
            getSubtopics({ topicId: selectedTopic }).then(res => res.success && setSubtopics(res.subtopics || []));
        }
    }, [selectedTopic]);

    useEffect(() => {
        if (selectedSubtopic) {
            getObjectives({ subtopicId: selectedSubtopic }).then(res => res.success && setObjectives(res.objectives || []));
        }
    }, [selectedSubtopic]);

    // Selection handlers: set the chosen level and clear everything downstream (data + selection),
    // mirroring exactly what the per-level effects used to clear synchronously.
    const handleSubjectChange = (v: string) => {
        setSelectedSubject(v);
        setStrands([]); setTopics([]); setSubtopics([]); setObjectives([]);
        setSelectedStrand(""); setSelectedTopic(""); setSelectedSubtopic(""); setSelectedObjective("");
    };
    const handleStrandChange = (v: string) => {
        setSelectedStrand(v);
        setTopics([]); setSubtopics([]); setObjectives([]);
        setSelectedTopic(""); setSelectedSubtopic(""); setSelectedObjective("");
    };
    const handleTopicChange = (v: string) => {
        setSelectedTopic(v);
        setSubtopics([]); setObjectives([]);
        setSelectedSubtopic(""); setSelectedObjective("");
    };
    const handleSubtopicChange = (v: string) => {
        setSelectedSubtopic(v);
        setObjectives([]);
        setSelectedObjective("");
    };

    // Propagate changes
    useEffect(() => {
        if (mode === "SPINE") {
            const parts = [];
            if (selectedSubject) parts.push(subjects.find(s => s.id === selectedSubject)?.name);
            if (selectedStrand) parts.push(strands.find(s => s.id === selectedStrand)?.name);
            if (selectedTopic) parts.push(topics.find(s => s.id === selectedTopic)?.name);
            if (selectedSubtopic) parts.push(subtopics.find(s => s.id === selectedSubtopic)?.name);
            if (selectedObjective) parts.push("Objective: " + objectives.find(s => s.id === selectedObjective)?.text);

            const fullTopic = parts.join(" > ");
            if (fullTopic) onTopicChange(fullTopic, { subjectId: selectedSubject, strandId: selectedStrand });
        } else if (mode === "FREE") {
            onTopicChange(freeText);
        } else if (mode === "STANDARD") {
            onTopicChange(`Standard: ${standardCode}`);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps -- notifies the parent of the composed topic on selection change; onTopicChange is a parent callback (not guaranteed memoized → adding it re-fires every parent render) and the subjects/strands/... arrays are read only to resolve display names
    }, [mode, selectedSubject, selectedStrand, selectedTopic, selectedSubtopic, selectedObjective, freeText, standardCode]);


    return (
        <div className="space-y-4">
            <Tabs value={mode} onValueChange={(v) => setMode(v as any)} className="w-full">
                <TabsList className="w-full grid grid-cols-3">
                    <TabsTrigger value="SPINE">Academic Spine</TabsTrigger>
                    <TabsTrigger value="FREE">Free Text</TabsTrigger>
                    <TabsTrigger value="STANDARD">Standard</TabsTrigger>
                </TabsList>

                <TabsContent value="SPINE" className="space-y-3 pt-2">
                    <div className="grid grid-cols-1 gap-3">
                        <Select value={selectedSubject} onValueChange={handleSubjectChange}>
                            <SelectTrigger><SelectValue placeholder="Select Subject" /></SelectTrigger>
                            <SelectContent>
                                {subjects.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                        {selectedSubject && <Select value={selectedStrand} onValueChange={handleStrandChange}>
                            <SelectTrigger><SelectValue placeholder="Select Strand" /></SelectTrigger>
                            <SelectContent>
                                {strands.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                            </SelectContent>
                        </Select>}
                        {selectedStrand && <Select value={selectedTopic} onValueChange={handleTopicChange}>
                            <SelectTrigger><SelectValue placeholder="Select Topic" /></SelectTrigger>
                            <SelectContent>
                                {topics.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                            </SelectContent>
                        </Select>}
                        {selectedTopic && <Select value={selectedSubtopic} onValueChange={handleSubtopicChange}>
                            <SelectTrigger><SelectValue placeholder="Select Subtopic" /></SelectTrigger>
                            <SelectContent>
                                {subtopics.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                            </SelectContent>
                        </Select>}
                        {selectedSubtopic && <Select value={selectedObjective} onValueChange={setSelectedObjective}>
                            <SelectTrigger><SelectValue placeholder="Select Objective" /></SelectTrigger>
                            <SelectContent>
                                {objectives.map(s => <SelectItem key={s.id} value={s.id}>{s.code} - {s.text.substring(0, 50)}...</SelectItem>)}
                            </SelectContent>
                        </Select>}
                    </div>
                </TabsContent>

                <TabsContent value="FREE" className="pt-2">
                    <Label>Topic or Prompt</Label>
                    <Textarea
                        placeholder="E.g., Photosynthesis in plants, The Civil War, etc."
                        value={freeText}
                        onChange={(e) => setFreeText(e.target.value)}
                        className="mt-1"
                    />
                </TabsContent>

                <TabsContent value="STANDARD" className="pt-2">
                    <Label>Standard Code</Label>
                    <Input
                        placeholder="E.g., CCSS.ELA-LITERACY.RL.5.1"
                        value={standardCode}
                        onChange={(e) => setStandardCode(e.target.value)}
                        className="mt-1"
                    />
                </TabsContent>
            </Tabs>
        </div>
    );
}

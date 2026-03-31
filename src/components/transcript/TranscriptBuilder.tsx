"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
    Save,
    Download,
    Settings,
    Eye,
} from "lucide-react";
import {
    BookOpen,
    Trophy,
    FileText,
    CheckCircle,
    WarningCircle,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";

import { TranscriptPreview } from "./TranscriptPreview";
import { CourseEntrySection } from "./CourseEntrySection";
import { ActivitiesSection } from "./ActivitiesSection";
import type { TranscriptData } from "./types";
import { exportToPDF } from "./pdfExport";
import { saveTranscript } from "@/server/actions/transcript";
import { getGradingScaleLegend } from "./utils";

interface TranscriptBuilderProps {
    initialData: TranscriptData;
    studentId: string;
}

export function TranscriptBuilder({ initialData, studentId }: TranscriptBuilderProps) {
    const [transcript, setTranscript] = useState<TranscriptData>(initialData);
    const [activeTab, setActiveTab] = useState("info");
    const [isSaving, setIsSaving] = useState(false);
    const router = useRouter();

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await saveTranscript(studentId, transcript, transcript.id);
            toast.success("Transcript Saved", {
                description: "Your changes have been saved successfully.",
            });
            router.refresh();
        } catch (error) {
            toast.error("Error Saving", {
                description: "Failed to save transcript. Please try again.",
            });
        } finally {
            setIsSaving(false);
        }
    };

    const handleExport = () => {
        exportToPDF(transcript);
    };

    // Helper to update transcript state
    const updateTranscript = (updates: Partial<TranscriptData>) => {
        setTranscript(prev => ({ ...prev, ...updates }));
    };

    // Calculate generic year ranges if missing
    const currentYear = new Date().getFullYear();
    useEffect(() => {
        // If we wanted to ensure year ranges exist, we could do it here
    }, []);

    return (
        <div className="container mx-auto py-6 max-w-7xl animate-in fade-in duration-500">
            {/* Sticky Header */}
            <div className="sticky top-0 z-40 bg-[#F3F4F6]/80 backdrop-blur-md border-b border-qc-border-subtle/50 pb-4 mb-6 pt-2 -mx-4 px-4 sm:-mx-8 sm:px-8 transition-all">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-[#383A57] mb-1">{transcript.name || "Transcript Builder"}</h1>
                        <p className="text-sm text-qc-text-muted font-medium">Customize, review, and export your official transcript.</p>
                    </div>
                    <div className="flex gap-3 shadow-sm rounded-lg bg-white p-1 border">
                        <Button
                            variant="ghost"
                            onClick={handleExport}
                            className="text-[#563963] hover:text-[#563963] hover:bg-[#563963]/5 font-medium"
                        >
                            <Download className="mr-2 h-4 w-4" /> Export PDF
                        </Button>
                        <div className="w-px bg-qc-surface-muted my-1" />
                        <Button
                            onClick={handleSave}
                            disabled={isSaving}
                            className="bg-[#563963] hover:bg-[#563963]/90 text-white font-semibold shadow-sm"
                        >
                            {isSaving ? "Saving..." : <><Save className="mr-2 h-4 w-4" /> Save Changes</>}
                        </Button>
                    </div>
                </div>
            </div>

            <div className="w-full">

                {/* Main Editor Area */}
                <div className="w-full space-y-6">
                    <Card className="border-t-4 border-t-[#383A57] shadow-sm">
                        <CardContent className="p-0">
                            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                                <div className="px-6 pt-6 pb-2">
                                    <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 bg-qc-surface-raised/80 p-1.5 rounded-xl border h-auto gap-2">
                                        <TabsTrigger
                                            value="info"
                                            className="py-2.5 data-[state=active]:bg-white data-[state=active]:text-[#563963] data-[state=active]:shadow-sm data-[state=active]:ring-1 data-[state=active]:ring-black/5 font-medium transition-all"
                                        >
                                            <Settings className="h-4 w-4 mr-2" /> Info
                                        </TabsTrigger>
                                        <TabsTrigger
                                            value="courses"
                                            className="py-2.5 data-[state=active]:bg-white data-[state=active]:text-[#563963] data-[state=active]:shadow-sm data-[state=active]:ring-1 data-[state=active]:ring-black/5 font-medium transition-all"
                                        >
                                            <BookOpen size={16} className="mr-2" /> Courses
                                        </TabsTrigger>
                                        <TabsTrigger
                                            value="activities"
                                            className="py-2.5 data-[state=active]:bg-white data-[state=active]:text-[#563963] data-[state=active]:shadow-sm data-[state=active]:ring-1 data-[state=active]:ring-black/5 font-medium transition-all"
                                        >
                                            <Trophy size={16} className="mr-2" /> Activities
                                        </TabsTrigger>
                                        <TabsTrigger
                                            value="preview"
                                            className="py-2.5 data-[state=active]:bg-[#563963] data-[state=active]:text-white data-[state=active]:shadow-md font-medium transition-all"
                                        >
                                            <Eye className="h-4 w-4 mr-2" /> Preview
                                        </TabsTrigger>
                                    </TabsList>
                                </div>

                                <div className="p-6 min-h-[500px]">
                                    {/* INFO TAB */}
                                    <TabsContent value="info" className="space-y-6 mt-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
                                        <div className="max-w-4xl mx-auto space-y-8">

                                            {/* Student Details Card */}
                                            <Card className="border shadow-sm overflow-hidden">
                                                <div className="bg-qc-surface-raised/50 px-6 py-4 border-b flex items-center gap-3">
                                                    <div className="h-8 w-8 rounded-full bg-[#563963]/10 flex items-center justify-center text-[#563963]">
                                                        <Settings className="h-4 w-4" />
                                                    </div>
                                                    <div>
                                                        <h3 className="font-semibold text-qc-charcoal">Student Information</h3>
                                                        <p className="text-xs text-qc-text-muted">Personal details for the transcript header.</p>
                                                    </div>
                                                </div>
                                                <CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                                                    <div className="space-y-2">
                                                        <Label className="text-qc-text-muted">First Name</Label>
                                                        <Input
                                                            value={transcript.studentInfo.firstName}
                                                            onChange={(e) => updateTranscript({
                                                                studentInfo: { ...transcript.studentInfo, firstName: e.target.value }
                                                            })}
                                                            className="border-qc-border-subtle focus:border-[#563963] focus:ring-[#563963]/10 transition-all"
                                                        />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label className="text-qc-text-muted">Last Name</Label>
                                                        <Input
                                                            value={transcript.studentInfo.lastName}
                                                            onChange={(e) => updateTranscript({
                                                                studentInfo: { ...transcript.studentInfo, lastName: e.target.value }
                                                            })}
                                                            className="border-qc-border-subtle focus:border-[#563963] focus:ring-[#563963]/10 transition-all"
                                                        />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label className="text-qc-text-muted">Date of Birth</Label>
                                                        <Input
                                                            type="date"
                                                            value={transcript.studentInfo.birthDate?.split('T')[0] || ""}
                                                            onChange={(e) => updateTranscript({
                                                                studentInfo: { ...transcript.studentInfo, birthDate: e.target.value }
                                                            })}
                                                            className="border-qc-border-subtle focus:border-[#563963] focus:ring-[#563963]/10 transition-all"
                                                        />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label className="text-qc-text-muted">Graduation Date</Label>
                                                        <Input
                                                            type="date"
                                                            value={transcript.studentInfo.graduationDate?.split('T')[0] || ""}
                                                            onChange={(e) => updateTranscript({
                                                                studentInfo: { ...transcript.studentInfo, graduationDate: e.target.value }
                                                            })}
                                                            className="border-qc-border-subtle focus:border-[#563963] focus:ring-[#563963]/10 transition-all"
                                                        />
                                                    </div>
                                                </CardContent>
                                            </Card>

                                            {/* School Details Card */}
                                            <Card className="border shadow-sm overflow-hidden">
                                                <div className="bg-qc-surface-raised/50 px-6 py-4 border-b flex items-center gap-3">
                                                    <div className="h-8 w-8 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-600">
                                                        <BookOpen size={16} />
                                                    </div>
                                                    <div>
                                                        <h3 className="font-semibold text-qc-charcoal">School Details</h3>
                                                        <p className="text-xs text-qc-text-muted">Homeschool or organization information.</p>
                                                    </div>
                                                </div>
                                                <CardContent className="p-6 space-y-6">
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                        <div className="space-y-2">
                                                            <Label className="text-qc-text-muted">School Name</Label>
                                                            <Input
                                                                value={transcript.schoolInfo.name}
                                                                onChange={(e) => updateTranscript({
                                                                    schoolInfo: { ...transcript.schoolInfo, name: e.target.value }
                                                                })}
                                                                className="border-qc-border-subtle focus:border-[#563963] focus:ring-[#563963]/10 transition-all"
                                                            />
                                                        </div>
                                                        <div className="space-y-2">
                                                            <Label className="text-qc-text-muted">School Email</Label>
                                                            <Input
                                                                value={transcript.schoolInfo.email}
                                                                onChange={(e) => updateTranscript({
                                                                    schoolInfo: { ...transcript.schoolInfo, email: e.target.value }
                                                                })}
                                                                className="border-qc-border-subtle focus:border-[#563963] focus:ring-[#563963]/10 transition-all"
                                                            />
                                                        </div>
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label className="text-qc-text-muted">Address</Label>
                                                        <Input
                                                            value={transcript.schoolInfo.address}
                                                            onChange={(e) => updateTranscript({
                                                                schoolInfo: { ...transcript.schoolInfo, address: e.target.value }
                                                            })}
                                                            className="border-qc-border-subtle focus:border-[#563963] focus:ring-[#563963]/10 transition-all"
                                                        />
                                                    </div>
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                        <div className="space-y-2">
                                                            <Label className="text-qc-text-muted">Administrator Name</Label>
                                                            <Input
                                                                value={transcript.schoolInfo.administrator}
                                                                onChange={(e) => updateTranscript({
                                                                    schoolInfo: { ...transcript.schoolInfo, administrator: e.target.value }
                                                                })}
                                                                className="border-qc-border-subtle focus:border-[#563963] focus:ring-[#563963]/10 transition-all"
                                                            />
                                                        </div>
                                                    </div>
                                                </CardContent>
                                            </Card>

                                            {/* Grading Settings Card */}
                                            <Card className="border shadow-sm overflow-hidden">
                                                <div className="bg-qc-surface-raised/50 px-6 py-4 border-b flex items-center gap-3">
                                                    <div className="h-8 w-8 rounded-full bg-green-500/10 flex items-center justify-center text-green-600">
                                                        <CheckCircle size={16} />
                                                    </div>
                                                    <div>
                                                        <h3 className="font-semibold text-qc-charcoal">Grading & Configuration</h3>
                                                        <p className="text-xs text-qc-text-muted">GPA scales, weighting, and display options.</p>
                                                    </div>
                                                </div>
                                                <CardContent className="p-6">
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                                        <div className="space-y-4">
                                                            <div className="space-y-2">
                                                                <Label className="text-qc-text-muted">Grading Scale</Label>
                                                                <Select
                                                                    value={transcript.gradingSettings?.scale || '10-point'}
                                                                    onValueChange={(val) => updateTranscript({
                                                                        gradingSettings: {
                                                                            grade: val as any,
                                                                            weighted: transcript.gradingSettings?.weighted ?? true,
                                                                            showNarratives: transcript.gradingSettings?.showNarratives
                                                                        } as any,
                                                                        gradingScale: getGradingScaleLegend(val as any)
                                                                    })}
                                                                >
                                                                    <SelectTrigger className="h-10 border-qc-border-subtle focus:border-[#563963] focus:ring-[#563963]/10">
                                                                        <SelectValue />
                                                                    </SelectTrigger>
                                                                    <SelectContent>
                                                                        <SelectItem value="10-point">Standard 10-Point (90-100 A)</SelectItem>
                                                                        <SelectItem value="7-point">7-Point Rigorous (93-100 A)</SelectItem>
                                                                        <SelectItem value="plus-minus">Plus/Minus (Competitive)</SelectItem>
                                                                    </SelectContent>
                                                                </Select>
                                                                <p className="text-[11px] text-qc-text-muted">Select the scale that matches your homeschooling approach.</p>
                                                            </div>
                                                            <div className="space-y-2">
                                                                <Label className="text-qc-text-muted">Transcript Title</Label>
                                                                <Input
                                                                    value={transcript.name}
                                                                    onChange={(e) => updateTranscript({ name: e.target.value })}
                                                                    className="h-10 border-qc-border-subtle focus:border-[#563963] focus:ring-[#563963]/10"
                                                                />
                                                            </div>
                                                        </div>

                                                        <div className="space-y-6 pt-1">
                                                            {/* Weighted GPA Toggle */}
                                                            <div className="flex items-start space-x-3 p-3 rounded-lg border border-qc-border-subtle/50 hover:border-qc-border-subtle hover:bg-qc-surface-raised/50 transition-colors">
                                                                <input
                                                                    type="checkbox"
                                                                    id="weighted-toggle"
                                                                    checked={transcript.gradingSettings?.weighted ?? true}
                                                                    onChange={(e) => updateTranscript({
                                                                        gradingSettings: {
                                                                            scale: transcript.gradingSettings?.scale || '10-point',
                                                                            weighted: e.target.checked,
                                                                            showNarratives: transcript.gradingSettings?.showNarratives
                                                                        }
                                                                    })}
                                                                    className="mt-1 h-4 w-4 rounded border-qc-border-subtle text-[#563963] focus:ring-[#563963]"
                                                                />
                                                                <div>
                                                                    <label htmlFor="weighted-toggle" className="text-sm font-medium text-qc-charcoal block">Weighted GPA (5.0 Add-on)</label>
                                                                    <p className="text-xs text-qc-text-muted mt-1 leading-relaxed">Honors courses +0.5, AP/IB/Dual +1.0. Capped at 5.0.</p>
                                                                </div>
                                                            </div>

                                                            {/* Narrative Toggle */}
                                                            <div className="flex items-start space-x-3 p-3 rounded-lg border border-qc-border-subtle/50 hover:border-qc-border-subtle hover:bg-qc-surface-raised/50 transition-colors">
                                                                <input
                                                                    type="checkbox"
                                                                    id="narrative-toggle"
                                                                    checked={transcript.gradingSettings?.showNarratives ?? false}
                                                                    onChange={(e) => updateTranscript({
                                                                        gradingSettings: {
                                                                            ...transcript.gradingSettings,
                                                                            scale: transcript.gradingSettings?.scale || '10-point',
                                                                            weighted: transcript.gradingSettings?.weighted ?? true,
                                                                            showNarratives: e.target.checked
                                                                        }
                                                                    })}
                                                                    className="mt-1 h-4 w-4 rounded border-qc-border-subtle text-[#563963] focus:ring-[#563963]"
                                                                />
                                                                <div>
                                                                    <label htmlFor="narrative-toggle" className="text-sm font-medium text-qc-charcoal block">Narrative Evaluations</label>
                                                                    <p className="text-xs text-qc-text-muted mt-1 leading-relaxed">Enable course descriptions & teacher comments.</p>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        </div>
                                    </TabsContent>

                                    {/* COURSES TAB */}
                                    <TabsContent value="courses" className="space-y-8 mt-0">
                                        <div className="max-w-5xl mx-auto">
                                            {[9, 10, 11, 12].map((grade) => {
                                                const yearStart = currentYear - (12 - grade);
                                                return (
                                                    <CourseEntrySection
                                                        key={grade}
                                                        gradeLevel={grade}
                                                        courses={transcript.courses}
                                                        yearRange={{ start: yearStart, end: yearStart + 1 }}
                                                        onChange={(updated) => updateTranscript({ courses: updated })}
                                                        settings={transcript.gradingSettings}
                                                    />
                                                );
                                            })}
                                        </div>
                                    </TabsContent>

                                    {/* ACTIVITIES TAB */}
                                    <TabsContent value="activities" className="mt-0">
                                        <div className="max-w-5xl mx-auto">
                                            <ActivitiesSection
                                                activities={transcript.activities}
                                                onChange={(updated) => updateTranscript({ activities: updated })}
                                            />
                                        </div>
                                    </TabsContent>

                                    {/* PREVIEW TAB (Full Width) */}
                                    <TabsContent value="preview" className="mt-0">
                                        <div className="overflow-auto border rounded-xl shadow-inner bg-qc-surface-raised p-8 flex justify-center min-h-[800px]">
                                            <div className="bg-white shadow-2xl" style={{ width: '8.5in', flexShrink: 0 }}>
                                                <TranscriptPreview transcript={transcript} />
                                            </div>
                                        </div>
                                    </TabsContent>

                                </div>
                            </Tabs>
                        </CardContent>
                    </Card>
                </div>

            </div>
        </div>
    );
}

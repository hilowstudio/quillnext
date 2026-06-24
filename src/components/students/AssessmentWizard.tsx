"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    CardDescription,
    CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { CheckCircle, ArrowRight, Brain, Sparkle, BookOpen, Target } from "@phosphor-icons/react";

// ----------------------------------------------------------------------
// DATA: QUESTIONNAIRES
// ----------------------------------------------------------------------

const PERSONALITY_QUESTIONS = [
    {
        id: "motivationalDriver",
        label: "When facing a difficult task, what helps the student most?",
        options: [
            {
                value: "The Why",
                label: "The 'Why' (Meaning)",
                desc: "Understanding real-world application or deeper meaning.",
            },
            {
                value: "The Win",
                label: "The 'Win' (Challenge)",
                desc: "A challenge, leaderboard, or chance to 'beat the system'.",
            },
            {
                value: "The List",
                label: "The 'List' (Structure)",
                desc: "Seeing a clear, finite checklist of steps to cross off.",
            },
            {
                value: "The Story",
                label: "The 'Story' (Fantasy)",
                desc: "Connecting the task to a narrative, character, or fantasy element.",
            },
        ],
    },
    {
        id: "creativityPreference",
        label: "How does the student react to open-ended creativity?",
        options: [
            {
                value: "Loves it",
                label: "Loves it",
                desc: "Wants blank canvas assignments (e.g., 'Invent a machine').",
            },
            {
                value: "Freezes",
                label: "Freezes",
                desc: "Needs specific prompts and constraints to get started.",
            },
        ],
    },
    {
        id: "feedbackStyle",
        label: "Which feedback style resonates best?",
        options: [
            {
                value: "Cheerleader",
                label: "Cheerleader",
                desc: "High energy, emojis, and praise.",
            },
            {
                value: "Coach",
                label: "Coach",
                desc: "Direct, concise correction favored on improvement.",
            },
            {
                value: "Socratic",
                label: "Socratic",
                desc: "Questions that lead them to the answer.",
            },
        ],
    },
    {
        id: "frustrationResponse",
        label: "When the student makes a mistake, they typically:",
        options: [
            { value: "Persist", label: "Persist", desc: "Try again immediately." },
            { value: "Deflect", label: "Deflect", desc: "Blame material or get angry." },
            { value: "Disengage", label: "Disengage", desc: "Shut down or quit." },
            { value: "Pivot", label: "Pivot", desc: "Ask 'Is this actually necessary?'" },
        ],
    },
    {
        id: "workStyle",
        label: "In an ideal school day, the student prefers:",
        options: [
            { value: "Autonomy", label: "Autonomy", desc: "Give me the list and leave me alone." },
            {
                value: "Collaboration",
                label: "Collaboration",
                desc: "Let's talk through this together.",
            },
        ],
    },
];

const LEARNING_STYLE_QUESTIONS = [
    {
        id: "inputMode",
        label: "If the student needs to learn how a car engine works, they would prefer:",
        options: [
            { value: "Visual", label: "Visual/Schematic", desc: "Labeled diagrams." },
            { value: "Auditory", label: "Video/Auditory", desc: "YouTube video explanation." },
            { value: "Textual", label: "Textual", desc: "Detailed article or textbook." },
            { value: "Kinesthetic", label: "Kinesthetic", desc: "Taking a model apart." },
        ],
    },
    {
        id: "contentDensity",
        label: "How does the student handle large blocks of text?",
        options: [
            { value: "Skimmer", label: "Skimmer", desc: "Scans for bold words and bullets." },
            { value: "Deep Reader", label: "Deep Reader", desc: "Reads word-for-word, loves detail." },
            { value: "Overwhelmed", label: "Overwhelmed", desc: "Needs micro-learning chunks." },
        ],
    },
    {
        id: "outputMode",
        label: "The student is most articulate when:",
        options: [
            { value: "Speaking", label: "Speaking", desc: "Explaining it out loud." },
            { value: "Writing", label: "Writing", desc: "Drafting essays or written answers." },
            { value: "Building", label: "Building", desc: "Creating a physical object." },
            { value: "Testing", label: "Testing", desc: "Selecting right answers (quizzes)." },
        ],
    },
    {
        id: "processingMode",
        label: "Does the student prefer the 'Forest' or the 'Trees'?",
        options: [
            { value: "The Forest", label: "The Forest", desc: "Big picture first." },
            { value: "The Trees", label: "The Trees", desc: "Details/Facts first." },
            { value: "Sequential", label: "Sequential", desc: "Step 1, then Step 2." },
        ],
    },
];

const INTEREST_WORLDS = [
    "The Natural World (Animals, Survival)",
    "The Tech World (Coding, Robots)",
    "The Fantasy/Sci-Fi World (Magic, Aliens)",
    "The Competitive World (Sports, Military)",
    "The Creative World (Music, Art)",
    "The Social World (Influencers, Pop Culture)",
];

const INTEREST_STRATEGIES = [
    {
        value: "Surface",
        label: "Surface Level (Word Replacement)",
        desc: "Just change names (e.g. counting Pokemon instead of apples).",
    },
    {
        value: "Deep",
        label: "Deep Integration (Thematic)",
        desc: "Build lessons around the topic (e.g. physics of soccer).",
    },
    {
        value: "Reward",
        label: "Reward Only",
        desc: "Use interests only as a reward after work is done.",
    },
];

type Step = "intro" | "personality" | "learning" | "interests" | "success";

interface AssessmentWizardProps {
    studentId: string;
}

export function AssessmentWizard({ studentId }: AssessmentWizardProps) {
    const router = useRouter();

    const [step, setStep] = useState<Step>("intro");
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Form State
    const [personalityAnswers, setPersonalityAnswers] = useState<Record<string, string>>({});
    const [learningAnswers, setLearningAnswers] = useState<Record<string, string>>({});

    // Interest State
    const [selectedWorlds, setSelectedWorlds] = useState<string[]>([]);
    const [specificEntities, setSpecificEntities] = useState<Record<string, string>>({});
    const [expertTopic, setExpertTopic] = useState("");
    const [integrationMode, setIntegrationMode] = useState("Surface");

    // Handlers
    const handleSaveStep = async (
        currentStepName: "personality" | "learning" | "interests",
        data: any,
    ) => {
        setIsSubmitting(true);
        try {
            const payload = {
                step: currentStepName,
                answers: data,
            };

            const response = await fetch(`/api/students/${studentId}/assessment`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                const errorData = await response.json();
                console.error("Server Error Details:", errorData);
                throw new Error(errorData.details || "Failed to save step");
            }

            const resData = await response.json();
            console.log(`${currentStepName} saved`, resData);

            // Advance Step
            if (currentStepName === "personality") setStep("learning");
            if (currentStepName === "learning") setStep("interests");
            if (currentStepName === "interests") setStep("success");

            toast.success("Progress saved!");
        } catch (error) {
            console.error(error);
            toast.error("Failed to save progress. Please try again.");
        } finally {
            setIsSubmitting(false);
        }
    };

    // Renderers
    const renderIntro = () => (
        <Card className="max-w-3xl mx-auto border-2 border-qc-primary/20 shadow-lg">
            <CardHeader className="text-center bg-qc-primary/5 pb-8 pt-8">
                <div className="mx-auto bg-qc-primary/10 p-4 rounded-full w-20 h-20 flex items-center justify-center mb-4">
                    <Brain size={40} className="text-qc-primary" />
                </div>
                <CardTitle className="text-3xl font-display text-qc-charcoal">
                    Student Inkling Profile Setup
                </CardTitle>
                <CardDescription className="text-lg max-w-xl mx-auto mt-2">
                    We need to &quot;calibrate&quot; Inkling to match this student&apos;s specific needs.
                    This process takes about 3 minutes.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 pt-8 px-8">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-qc-parchment p-4 rounded-lg border border-qc-border-subtle">
                        <Target size={24} className="text-qc-primary mb-2" />
                        <h3 className="font-bold text-qc-charcoal">1. Motivation</h3>
                        <p className="text-sm text-qc-text-muted">Determine what drives them and how to hook their attention.</p>
                    </div>
                    <div className="bg-qc-parchment p-4 rounded-lg border border-qc-border-subtle">
                        <BookOpen size={24} className="text-qc-primary mb-2" />
                        <h3 className="font-bold text-qc-charcoal">2. Learning Style</h3>
                        <p className="text-sm text-qc-text-muted">Calibrate how content is formatted and delivered.</p>
                    </div>
                    <div className="bg-qc-parchment p-4 rounded-lg border border-qc-border-subtle">
                        <Sparkle size={24} className="text-qc-primary mb-2" />
                        <h3 className="font-bold text-qc-charcoal">3. Interests</h3>
                        <p className="text-sm text-qc-text-muted">Inject their favorite topics/games into math & reading.</p>
                    </div>
                </div>
            </CardContent>
            <CardFooter className="flex justify-center pb-8">
                <Button size="lg" onClick={() => setStep("personality")} className="w-full md:w-auto px-12">
                    Start Calibration <ArrowRight size={16} className="ml-2" />
                </Button>
            </CardFooter>
        </Card>
    );

    const renderPersonality = () => (
        <Card className="max-w-2xl mx-auto">
            <CardHeader>
                <div className="text-sm font-bold text-qc-primary tracking-wider uppercase mb-2">Step 1 of 3</div>
                <CardTitle className="text-2xl font-display">Personality & Motivation</CardTitle>
                <CardDescription>How should Inkling talk to expectations?</CardDescription>
            </CardHeader>
            <CardContent className="space-y-8">
                {PERSONALITY_QUESTIONS.map((q) => (
                    <div key={q.id} className="space-y-3">
                        <Label className="text-base font-semibold text-qc-charcoal">{q.label}</Label>
                        <RadioGroup
                            onValueChange={(val: string) => setPersonalityAnswers({ ...personalityAnswers, [q.id]: val })}
                            value={personalityAnswers[q.id]}
                            className="grid grid-cols-1 md:grid-cols-2 gap-3"
                        >
                            {q.options.map((opt) => (
                                <Label
                                    key={opt.value}
                                    className={`flex flex-col p-4 border rounded-lg cursor-pointer transition-all hover:bg-qc-primary/5 ${personalityAnswers[q.id] === opt.value
                                        ? "border-qc-primary bg-qc-primary/5 ring-1 ring-qc-primary"
                                        : "border-qc-border-subtle"
                                        }`}
                                >
                                    <div className="flex items-center gap-2 mb-1">
                                        <RadioGroupItem value={opt.value} id={`${q.id}-${opt.value}`} />
                                        <span className="font-bold text-qc-charcoal">{opt.label}</span>
                                    </div>
                                    <span className="text-xs text-qc-text-muted ml-6 leading-relaxed">
                                        {opt.desc}
                                    </span>
                                </Label>
                            ))}
                        </RadioGroup>
                    </div>
                ))}
            </CardContent>
            <CardFooter className="flex justify-between border-t pt-6 bg-qc-surface-raised/50">
                <Button variant="ghost" onClick={() => setStep("intro")}>Back</Button>
                <Button
                    disabled={Object.keys(personalityAnswers).length < PERSONALITY_QUESTIONS.length || isSubmitting}
                    onClick={() => handleSaveStep("personality", personalityAnswers)}
                >
                    {isSubmitting ? "Saving..." : "Next Step"}
                </Button>
            </CardFooter>
        </Card>
    );

    const renderLearning = () => (
        <Card className="max-w-2xl mx-auto">
            <CardHeader>
                <div className="text-sm font-bold text-qc-primary tracking-wider uppercase mb-2">Step 2 of 3</div>
                <CardTitle className="text-2xl font-display">Cognitive Preferences</CardTitle>
                <CardDescription>How should content be formatted?</CardDescription>
            </CardHeader>
            <CardContent className="space-y-8">
                {LEARNING_STYLE_QUESTIONS.map((q) => (
                    <div key={q.id} className="space-y-3">
                        <Label className="text-base font-semibold text-qc-charcoal">{q.label}</Label>
                        <RadioGroup
                            onValueChange={(val: string) => setLearningAnswers({ ...learningAnswers, [q.id]: val })}
                            value={learningAnswers[q.id]}
                            className="grid grid-cols-1 gap-3"
                        >
                            {q.options.map((opt) => (
                                <Label
                                    key={opt.value}
                                    className={`flex items-center p-4 border rounded-lg cursor-pointer transition-all hover:bg-qc-primary/5 ${learningAnswers[q.id] === opt.value
                                        ? "border-qc-primary bg-qc-primary/5 ring-1 ring-qc-primary"
                                        : "border-qc-border-subtle"
                                        }`}
                                >
                                    <RadioGroupItem value={opt.value} id={`${q.id}-${opt.value}`} className="mr-3" />
                                    <div>
                                        <span className="font-bold text-qc-charcoal block">{opt.label}</span>
                                        <span className="text-xs text-qc-text-muted">{opt.desc}</span>
                                    </div>
                                </Label>
                            ))}
                        </RadioGroup>
                    </div>
                ))}
            </CardContent>
            <CardFooter className="flex justify-between border-t pt-6 bg-qc-surface-raised/50">
                <Button variant="ghost" onClick={() => setStep("personality")}>Back</Button>
                <Button
                    disabled={Object.keys(learningAnswers).length < LEARNING_STYLE_QUESTIONS.length || isSubmitting}
                    onClick={() => handleSaveStep("learning", learningAnswers)}
                >
                    {isSubmitting ? "Saving..." : "Next Step"}
                </Button>
            </CardFooter>
        </Card>
    );

    const renderInterests = () => (
        <Card className="max-w-2xl mx-auto">
            <CardHeader>
                <div className="text-sm font-bold text-qc-primary tracking-wider uppercase mb-2">Step 3 of 3</div>
                <CardTitle className="text-2xl font-display">Interests & Passions</CardTitle>
                <CardDescription>What specific topics should be injected into lessons?</CardDescription>
            </CardHeader>
            <CardContent className="space-y-8">
                {/* World Selection */}
                <div className="space-y-3">
                    <Label className="text-base font-semibold">Which &quot;worlds&quot; do they enjoy?</Label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {INTEREST_WORLDS.map((world) => (
                            <div key={world} className="flex items-center space-x-2">
                                <Checkbox
                                    id={world}
                                    checked={selectedWorlds.includes(world)}
                                    onCheckedChange={(checked) => {
                                        if (checked) setSelectedWorlds([...selectedWorlds, world]);
                                        else setSelectedWorlds(selectedWorlds.filter(w => w !== world));
                                    }}
                                />
                                <label htmlFor={world} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer">
                                    {world}
                                </label>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Specific Favorites */}
                <div className="space-y-4">
                    <Label className="text-base font-semibold">Specific Favorites (For Word Replacement)</Label>
                    <div className="grid grid-cols-1 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="fav-sport" className="text-xs uppercase text-qc-text-muted">Favorite Sport/Team</Label>
                            <Input
                                id="fav-sport"
                                placeholder="e.g. Basketball / Golden State Warriors"
                                value={specificEntities["Sports"] || ""}
                                onChange={(e) => setSpecificEntities({ ...specificEntities, "Sports": e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="fav-game" className="text-xs uppercase text-qc-text-muted">Favorite Video Game</Label>
                            <Input
                                id="fav-game"
                                placeholder="e.g. Minecraft, Roblox"
                                value={specificEntities["Video Games"] || ""}
                                onChange={(e) => setSpecificEntities({ ...specificEntities, "Video Games": e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="fav-show" className="text-xs uppercase text-qc-text-muted">Favorite Show/Book</Label>
                            <Input
                                id="fav-show"
                                placeholder="e.g. Bluey, Harry Potter"
                                value={specificEntities["Media"] || ""}
                                onChange={(e) => setSpecificEntities({ ...specificEntities, "Media": e.target.value })}
                            />
                        </div>
                    </div>
                </div>

                <div className="space-y-2">
                    <Label className="text-base font-semibold">Expert Subject (For Analogies)</Label>
                    <Input
                        placeholder="Topic they know a LOT about (e.g. Dinosaurs, Cars)"
                        value={expertTopic}
                        onChange={(e) => setExpertTopic(e.target.value)}
                    />
                </div>

                <div className="space-y-3">
                    <Label className="text-base font-semibold">Integration Strategy</Label>
                    <RadioGroup
                        onValueChange={setIntegrationMode}
                        value={integrationMode}
                        className="grid grid-cols-1 gap-3"
                    >
                        {INTEREST_STRATEGIES.map((opt) => (
                            <Label
                                key={opt.value}
                                className={`flex items-center p-3 border rounded-lg cursor-pointer ${integrationMode === opt.value
                                    ? "border-qc-primary bg-qc-primary/5"
                                    : "border-qc-border-subtle"
                                    }`}
                            >
                                <RadioGroupItem value={opt.value} id={`int-${opt.value}`} className="mr-3" />
                                <div>
                                    <span className="font-bold text-sm block">{opt.label}</span>
                                    <span className="text-xs text-qc-text-muted">{opt.desc}</span>
                                </div>
                            </Label>
                        ))}
                    </RadioGroup>
                </div>

            </CardContent>
            <CardFooter className="flex justify-between border-t pt-6 bg-qc-surface-raised/50">
                <Button variant="ghost" onClick={() => setStep("learning")}>Back</Button>
                <Button
                    disabled={isSubmitting}
                    onClick={() => handleSaveStep("interests", {
                        hookThemes: selectedWorlds,
                        specificEntities,
                        expertTopics: [expertTopic],
                        integrationMode
                    })}
                >
                    {isSubmitting ? "Finalizing..." : "Complete Setup"}
                </Button>
            </CardFooter>
        </Card>
    );

    const renderSuccess = () => (
        <Card className="max-w-md mx-auto text-center py-10">
            <CardContent className="space-y-6">
                <div className="mx-auto bg-green-100 text-green-600 w-20 h-20 rounded-full flex items-center justify-center">
                    <CheckCircle size={40} />
                </div>
                <h2 className="text-3xl font-display text-qc-charcoal text-balance">Profile Calibration Complete!</h2>
                <p className="text-qc-text-muted qc-prose">
                    We have configured Inkling to match this student&apos;s learning style.
                </p>
                <div className="pt-4">
                    <Button asChild size="lg" className="w-full">
                        <Link href={`/students/${studentId}`}>Return to Student Profile</Link>
                    </Button>
                </div>
            </CardContent>
        </Card>
    );

    return (
        <div className="min-h-screen bg-qc-surface-raisedpy-12 px-4">
            {step === "intro" && renderIntro()}
            {step === "personality" && renderPersonality()}
            {step === "learning" && renderLearning()}
            {step === "interests" && renderInterests()}
            {step === "success" && renderSuccess()}
        </div>
    );
}

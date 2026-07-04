"use client";

import { useState } from "react";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
    Compass,
    Check,
    CheckCircle,
    ArrowRight,
    ArrowLeft,
    Target,
    BookOpen,
    Sparkle,
} from "@phosphor-icons/react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

// ----------------------------------------------------------------------
// DATA: QUESTIONNAIRES
// (option `value`s + payload keys are the AI contract — DO NOT rename)
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

// ----------------------------------------------------------------------
// STEP METADATA (drives the progress rail + headers)
// ----------------------------------------------------------------------

type Step = "intro" | "personality" | "learning" | "interests" | "success";

const QUESTION_STEPS = [
    {
        key: "personality" as const,
        title: "Personality",
        icon: Target,
        heading: "Personality & Motivation",
        eyebrow: "How to hook their attention",
        description: "How should Inkling motivate and speak to this student?",
    },
    {
        key: "learning" as const,
        title: "Learning",
        icon: BookOpen,
        heading: "Cognitive Preferences",
        eyebrow: "How to format the content",
        description: "How should lessons be shaped so they land clearly?",
    },
    {
        key: "interests" as const,
        title: "Interests",
        icon: Sparkle,
        heading: "Interests & Passions",
        eyebrow: "What to weave into lessons",
        description: "Which topics should we thread through math, reading, and more?",
    },
];

const stepIndex = (step: Step) => QUESTION_STEPS.findIndex((s) => s.key === step);

// ----------------------------------------------------------------------
// PRESENTATIONAL PIECES
// ----------------------------------------------------------------------

/** The persistent calibration rail shown across the three question steps. */
function ProgressRail({ activeIndex }: { activeIndex: number }) {
    return (
        <nav aria-label="Assessment progress" className="mb-8">
            <div className="flex items-start justify-between">
                {QUESTION_STEPS.map((s, index) => {
                    const done = index < activeIndex;
                    const active = index === activeIndex;
                    const StepIcon = s.icon;
                    return (
                        <div key={s.key} className="contents">
                            <div className="z-10 flex flex-1 flex-col items-center text-center">
                                <div
                                    className={cn(
                                        "flex h-11 w-11 items-center justify-center rounded-full border-2 transition-colors",
                                        done && "border-qc-primary bg-qc-primary text-white",
                                        active &&
                                            "border-qc-primary bg-white text-qc-primary shadow-qc-sm",
                                        !done &&
                                            !active &&
                                            "border-qc-border-subtle bg-white/70 text-qc-text-muted",
                                    )}
                                >
                                    {done ? (
                                        <Check weight="bold" size={18} />
                                    ) : (
                                        <StepIcon weight={active ? "fill" : "regular"} size={20} />
                                    )}
                                </div>
                                <span
                                    className={cn(
                                        "mt-2 text-xs tracking-wide",
                                        active
                                            ? "font-semibold text-qc-charcoal"
                                            : "text-qc-text-muted",
                                    )}
                                >
                                    {s.title}
                                </span>
                            </div>
                            {index < QUESTION_STEPS.length - 1 && (
                                <div
                                    className={cn(
                                        "mx-2 mt-[21px] h-0.5 flex-1 rounded-full transition-colors",
                                        index < activeIndex
                                            ? "bg-qc-primary"
                                            : "bg-qc-border-subtle",
                                    )}
                                />
                            )}
                        </div>
                    );
                })}
            </div>
        </nav>
    );
}

/** A single selectable answer — an accessible radio styled as a card. */
function OptionCard({
    groupId,
    value,
    label,
    desc,
    selected,
}: {
    groupId: string;
    value: string;
    label: string;
    desc: string;
    selected: boolean;
}) {
    return (
        <Label
            htmlFor={`${groupId}-${value}`}
            className={cn(
                "group relative flex cursor-pointer items-start gap-3 rounded-qc-lg border p-4 pr-9 transition-all",
                "has-[button:focus-visible]:ring-2 has-[button:focus-visible]:ring-qc-primary has-[button:focus-visible]:ring-offset-2",
                selected
                    ? "border-qc-primary bg-qc-primary/[0.06] shadow-qc-sm"
                    : "border-qc-border-subtle bg-white/60 hover:border-qc-primary/40 hover:bg-qc-primary/[0.03]",
            )}
        >
            {/* Real radio kept for keyboard/AT; visually replaced by the card state. */}
            <RadioGroupItem value={value} id={`${groupId}-${value}`} className="sr-only" />
            <span
                aria-hidden
                className={cn(
                    "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                    selected
                        ? "border-qc-primary bg-qc-primary text-white"
                        : "border-qc-border-strong bg-white text-transparent group-hover:border-qc-primary/60",
                )}
            >
                <Check weight="bold" size={12} />
            </span>
            <span className="min-w-0">
                <span className="block font-semibold leading-tight text-qc-charcoal">{label}</span>
                <span className="mt-1 block text-xs leading-relaxed text-qc-text-muted">
                    {desc}
                </span>
            </span>
            <Sparkle
                weight="fill"
                size={14}
                aria-hidden
                className={cn(
                    "absolute right-3.5 top-4 text-qc-secondary transition-opacity",
                    selected ? "opacity-100" : "opacity-0",
                )}
            />
        </Label>
    );
}

/** Shared shell: gradient-accent glass card with a serif header. */
function StepCard({
    eyebrow,
    heading,
    description,
    children,
    footer,
}: {
    eyebrow: string;
    heading: string;
    description: string;
    children: React.ReactNode;
    footer: React.ReactNode;
}) {
    return (
        <Card className="relative overflow-hidden border-qc-border-subtle bg-white/80 shadow-qc-lg backdrop-blur-sm">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-qc-primary via-qc-secondary to-qc-primary opacity-80" />
            <CardHeader className="px-6 pt-8 md:px-10">
                <div className="text-xs font-semibold uppercase tracking-[0.14em] text-qc-secondary">
                    {eyebrow}
                </div>
                <CardTitle className="mt-1 font-display text-3xl tracking-tight text-qc-primary">
                    {heading}
                </CardTitle>
                <CardDescription className="text-base text-qc-text-muted">
                    {description}
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-8 px-6 md:px-10">{children}</CardContent>
            <CardFooter className="mt-2 flex items-center justify-between gap-4 border-t border-qc-border-subtle px-6 py-6 md:px-10">
                {footer}
            </CardFooter>
        </Card>
    );
}

interface AssessmentWizardProps {
    studentId: string;
}

export function AssessmentWizard({ studentId }: AssessmentWizardProps) {
    const [step, setStep] = useState<Step>("intro");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const reduceMotion = useReducedMotion();

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
        data: Record<string, unknown>,
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

    const personalityAnswered = Object.keys(personalityAnswers).length;
    const learningAnswered = Object.keys(learningAnswers).length;

    // Motion (respects prefers-reduced-motion)
    const variants = reduceMotion
        ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
        : {
              initial: { opacity: 0, y: 12 },
              animate: { opacity: 1, y: 0 },
              exit: { opacity: 0, y: -12 },
          };

    // ------------------------------------------------------------------
    // RENDERERS
    // ------------------------------------------------------------------

    const renderIntro = () => (
        <Card className="relative overflow-hidden border-qc-border-subtle bg-white/80 shadow-qc-lg backdrop-blur-sm">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-qc-primary via-qc-secondary to-qc-primary opacity-80" />
            <CardHeader className="items-center px-6 pb-4 pt-12 text-center md:px-12">
                <div className="relative mx-auto mb-5 flex h-20 w-20 items-center justify-center">
                    <span className="absolute inset-0 rounded-full bg-qc-primary/10" />
                    <span className="absolute inset-2 rounded-full border border-qc-secondary/40" />
                    <Compass weight="duotone" size={40} className="relative text-qc-primary" />
                </div>
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-qc-secondary">
                    Inkling Profile
                </div>
                <CardTitle className="mt-2 font-display text-4xl tracking-tight text-qc-primary">
                    Calibrate the Compass
                </CardTitle>
                <CardDescription className="mx-auto mt-3 max-w-xl text-lg leading-relaxed text-qc-text-muted">
                    A few quick questions tune Inkling to how this student thinks, learns, and stays
                    curious — so every generated lesson feels made for them.
                </CardDescription>
                <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-qc-border-subtle bg-qc-parchment px-4 py-1.5 text-sm font-medium text-qc-text-muted">
                    <Sparkle weight="fill" size={14} className="text-qc-secondary" />
                    About 3 minutes
                </div>
            </CardHeader>
            <CardContent className="px-6 pt-6 md:px-12">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    {QUESTION_STEPS.map((s, i) => {
                        const StepIcon = s.icon;
                        return (
                            <div
                                key={s.key}
                                className="rounded-qc-lg border border-qc-border-subtle bg-qc-parchment/70 p-5"
                            >
                                <div className="flex items-center gap-2">
                                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-qc-primary/10">
                                        <StepIcon weight="fill" size={18} className="text-qc-primary" />
                                    </span>
                                    <span className="text-xs font-semibold uppercase tracking-wider text-qc-text-muted">
                                        Part {i + 1}
                                    </span>
                                </div>
                                <h3 className="mt-3 font-display text-xl text-qc-charcoal">
                                    {s.title}
                                </h3>
                                <p className="mt-1 text-sm leading-relaxed text-qc-text-muted">
                                    {s.eyebrow}.
                                </p>
                            </div>
                        );
                    })}
                </div>
            </CardContent>
            <CardFooter className="flex justify-center px-6 pb-12 pt-8 md:px-12">
                <Button
                    size="lg"
                    onClick={() => setStep("personality")}
                    className="h-auto gap-2 px-10 py-6 text-base shadow-qc-md transition-all hover:shadow-qc-lg"
                >
                    Begin Calibration
                    <ArrowRight weight="bold" size={18} />
                </Button>
            </CardFooter>
        </Card>
    );

    const renderPersonality = () => {
        const meta = QUESTION_STEPS[0];
        return (
            <StepCard
                eyebrow={meta.eyebrow}
                heading={meta.heading}
                description={meta.description}
                footer={
                    <>
                        <Button
                            variant="ghost"
                            onClick={() => setStep("intro")}
                            className="gap-2 text-qc-text-muted hover:text-qc-primary"
                        >
                            <ArrowLeft weight="bold" size={16} />
                            Back
                        </Button>
                        <div className="flex items-center gap-4">
                            <span className="hidden text-sm text-qc-text-muted sm:inline">
                                {personalityAnswered} of {PERSONALITY_QUESTIONS.length} answered
                            </span>
                            <Button
                                disabled={
                                    personalityAnswered < PERSONALITY_QUESTIONS.length ||
                                    isSubmitting
                                }
                                onClick={() => handleSaveStep("personality", personalityAnswers)}
                                className="h-auto gap-2 px-6 py-5 text-base shadow-qc-sm transition-all hover:shadow-qc-md"
                            >
                                {isSubmitting ? "Saving…" : "Next Step"}
                                {!isSubmitting && <ArrowRight weight="bold" size={16} />}
                            </Button>
                        </div>
                    </>
                }
            >
                {PERSONALITY_QUESTIONS.map((q, i) => (
                    <fieldset key={q.id} className="space-y-3">
                        <legend className="flex gap-2 text-base font-semibold text-qc-charcoal">
                            <span className="text-qc-secondary">{i + 1}.</span>
                            <span>{q.label}</span>
                        </legend>
                        <RadioGroup
                            onValueChange={(val: string) =>
                                setPersonalityAnswers({ ...personalityAnswers, [q.id]: val })
                            }
                            value={personalityAnswers[q.id]}
                            className="grid grid-cols-1 gap-3 md:grid-cols-2"
                        >
                            {q.options.map((opt) => (
                                <OptionCard
                                    key={opt.value}
                                    groupId={q.id}
                                    value={opt.value}
                                    label={opt.label}
                                    desc={opt.desc}
                                    selected={personalityAnswers[q.id] === opt.value}
                                />
                            ))}
                        </RadioGroup>
                    </fieldset>
                ))}
            </StepCard>
        );
    };

    const renderLearning = () => {
        const meta = QUESTION_STEPS[1];
        return (
            <StepCard
                eyebrow={meta.eyebrow}
                heading={meta.heading}
                description={meta.description}
                footer={
                    <>
                        <Button
                            variant="ghost"
                            onClick={() => setStep("personality")}
                            className="gap-2 text-qc-text-muted hover:text-qc-primary"
                        >
                            <ArrowLeft weight="bold" size={16} />
                            Back
                        </Button>
                        <div className="flex items-center gap-4">
                            <span className="hidden text-sm text-qc-text-muted sm:inline">
                                {learningAnswered} of {LEARNING_STYLE_QUESTIONS.length} answered
                            </span>
                            <Button
                                disabled={
                                    learningAnswered < LEARNING_STYLE_QUESTIONS.length ||
                                    isSubmitting
                                }
                                onClick={() => handleSaveStep("learning", learningAnswers)}
                                className="h-auto gap-2 px-6 py-5 text-base shadow-qc-sm transition-all hover:shadow-qc-md"
                            >
                                {isSubmitting ? "Saving…" : "Next Step"}
                                {!isSubmitting && <ArrowRight weight="bold" size={16} />}
                            </Button>
                        </div>
                    </>
                }
            >
                {LEARNING_STYLE_QUESTIONS.map((q, i) => (
                    <fieldset key={q.id} className="space-y-3">
                        <legend className="flex gap-2 text-base font-semibold text-qc-charcoal">
                            <span className="text-qc-secondary">{i + 1}.</span>
                            <span>{q.label}</span>
                        </legend>
                        <RadioGroup
                            onValueChange={(val: string) =>
                                setLearningAnswers({ ...learningAnswers, [q.id]: val })
                            }
                            value={learningAnswers[q.id]}
                            className="grid grid-cols-1 gap-3 sm:grid-cols-2"
                        >
                            {q.options.map((opt) => (
                                <OptionCard
                                    key={opt.value}
                                    groupId={q.id}
                                    value={opt.value}
                                    label={opt.label}
                                    desc={opt.desc}
                                    selected={learningAnswers[q.id] === opt.value}
                                />
                            ))}
                        </RadioGroup>
                    </fieldset>
                ))}
            </StepCard>
        );
    };

    const renderInterests = () => {
        const meta = QUESTION_STEPS[2];
        return (
            <StepCard
                eyebrow={meta.eyebrow}
                heading={meta.heading}
                description={meta.description}
                footer={
                    <>
                        <Button
                            variant="ghost"
                            onClick={() => setStep("learning")}
                            className="gap-2 text-qc-text-muted hover:text-qc-primary"
                        >
                            <ArrowLeft weight="bold" size={16} />
                            Back
                        </Button>
                        <Button
                            disabled={isSubmitting}
                            onClick={() =>
                                handleSaveStep("interests", {
                                    hookThemes: selectedWorlds,
                                    specificEntities,
                                    expertTopics: [expertTopic],
                                    integrationMode,
                                })
                            }
                            className="h-auto gap-2 bg-qc-secondary px-6 py-5 text-base font-medium text-qc-charcoal shadow-qc-sm transition-all hover:bg-qc-secondary/90 hover:shadow-qc-md"
                        >
                            {isSubmitting ? "Finalizing…" : "Complete Setup"}
                            {!isSubmitting && <CheckCircle weight="fill" size={18} />}
                        </Button>
                    </>
                }
            >
                {/* World Selection */}
                <div className="space-y-3">
                    <Label className="text-base font-semibold text-qc-charcoal">
                        Which &quot;worlds&quot; do they enjoy?
                    </Label>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                        {INTEREST_WORLDS.map((world) => {
                            const checked = selectedWorlds.includes(world);
                            return (
                                <Label
                                    key={world}
                                    htmlFor={`world-${world}`}
                                    className={cn(
                                        "group relative flex cursor-pointer items-center gap-3 rounded-qc-lg border p-3.5 pr-9 transition-all",
                                        "has-[button:focus-visible]:ring-2 has-[button:focus-visible]:ring-qc-primary has-[button:focus-visible]:ring-offset-2",
                                        checked
                                            ? "border-qc-primary bg-qc-primary/[0.06] shadow-qc-sm"
                                            : "border-qc-border-subtle bg-white/60 hover:border-qc-primary/40 hover:bg-qc-primary/[0.03]",
                                    )}
                                >
                                    <Checkbox
                                        id={`world-${world}`}
                                        checked={checked}
                                        onCheckedChange={(v) => {
                                            if (v) setSelectedWorlds([...selectedWorlds, world]);
                                            else
                                                setSelectedWorlds(
                                                    selectedWorlds.filter((w) => w !== world),
                                                );
                                        }}
                                        className="sr-only"
                                    />
                                    <span
                                        aria-hidden
                                        className={cn(
                                            "flex h-5 w-5 shrink-0 items-center justify-center rounded-[6px] border-2 transition-colors",
                                            checked
                                                ? "border-qc-primary bg-qc-primary text-white"
                                                : "border-qc-border-strong bg-white text-transparent group-hover:border-qc-primary/60",
                                        )}
                                    >
                                        <Check weight="bold" size={12} />
                                    </span>
                                    <span className="text-sm font-medium leading-snug text-qc-charcoal">
                                        {world}
                                    </span>
                                </Label>
                            );
                        })}
                    </div>
                </div>

                {/* Specific Favorites */}
                <div className="space-y-4 rounded-qc-lg border border-qc-border-subtle bg-qc-parchment/60 p-5">
                    <div>
                        <Label className="text-base font-semibold text-qc-charcoal">
                            Specific favorites
                        </Label>
                        <p className="text-sm text-qc-text-muted">
                            Named things we can drop straight into problems and prompts.
                        </p>
                    </div>
                    <div className="grid grid-cols-1 gap-4">
                        <div className="space-y-1.5">
                            <Label
                                htmlFor="fav-sport"
                                className="text-xs uppercase tracking-wide text-qc-text-muted"
                            >
                                Favorite sport / team
                            </Label>
                            <Input
                                id="fav-sport"
                                placeholder="e.g. Basketball / Golden State Warriors"
                                value={specificEntities["Sports"] || ""}
                                onChange={(e) =>
                                    setSpecificEntities({
                                        ...specificEntities,
                                        Sports: e.target.value,
                                    })
                                }
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label
                                htmlFor="fav-game"
                                className="text-xs uppercase tracking-wide text-qc-text-muted"
                            >
                                Favorite video game
                            </Label>
                            <Input
                                id="fav-game"
                                placeholder="e.g. Minecraft, Roblox"
                                value={specificEntities["Video Games"] || ""}
                                onChange={(e) =>
                                    setSpecificEntities({
                                        ...specificEntities,
                                        "Video Games": e.target.value,
                                    })
                                }
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label
                                htmlFor="fav-show"
                                className="text-xs uppercase tracking-wide text-qc-text-muted"
                            >
                                Favorite show / book
                            </Label>
                            <Input
                                id="fav-show"
                                placeholder="e.g. Bluey, Harry Potter"
                                value={specificEntities["Media"] || ""}
                                onChange={(e) =>
                                    setSpecificEntities({
                                        ...specificEntities,
                                        Media: e.target.value,
                                    })
                                }
                            />
                        </div>
                    </div>
                </div>

                {/* Expert Subject */}
                <div className="space-y-1.5">
                    <Label
                        htmlFor="expert-topic"
                        className="text-base font-semibold text-qc-charcoal"
                    >
                        Expert subject{" "}
                        <span className="font-normal text-qc-text-muted">(for analogies)</span>
                    </Label>
                    <Input
                        id="expert-topic"
                        placeholder="Something they know a LOT about (e.g. Dinosaurs, Cars)"
                        value={expertTopic}
                        onChange={(e) => setExpertTopic(e.target.value)}
                    />
                </div>

                {/* Integration Strategy */}
                <div className="space-y-3">
                    <Label className="text-base font-semibold text-qc-charcoal">
                        Integration strategy
                    </Label>
                    <RadioGroup
                        onValueChange={setIntegrationMode}
                        value={integrationMode}
                        className="grid grid-cols-1 gap-3"
                    >
                        {INTEREST_STRATEGIES.map((opt) => (
                            <OptionCard
                                key={opt.value}
                                groupId="integration"
                                value={opt.value}
                                label={opt.label}
                                desc={opt.desc}
                                selected={integrationMode === opt.value}
                            />
                        ))}
                    </RadioGroup>
                </div>
            </StepCard>
        );
    };

    const renderSuccess = () => (
        <Card className="relative mx-auto max-w-lg overflow-hidden border-qc-border-subtle bg-white/80 text-center shadow-qc-lg backdrop-blur-sm">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-qc-primary via-qc-secondary to-qc-primary opacity-80" />
            <CardContent className="space-y-6 px-8 py-12">
                <div className="relative mx-auto flex h-20 w-20 items-center justify-center">
                    <span className="absolute inset-0 rounded-full bg-qc-success-bg" />
                    <span className="absolute inset-2 rounded-full border border-qc-success-border" />
                    <CheckCircle weight="fill" size={40} className="relative text-qc-success" />
                </div>
                <div className="space-y-2">
                    <div className="text-xs font-semibold uppercase tracking-[0.16em] text-qc-secondary">
                        Calibration complete
                    </div>
                    <h2 className="text-balance font-display text-3xl text-qc-primary">
                        Inkling is tuned in
                    </h2>
                    <p className="mx-auto max-w-sm text-qc-text-muted">
                        We&apos;ve configured Inkling to match this student&apos;s motivation,
                        learning style, and interests. It&apos;ll shape everything you generate from
                        here.
                    </p>
                </div>
                <div className="pt-2">
                    <Button
                        asChild
                        size="lg"
                        className="h-auto w-full gap-2 px-8 py-6 text-base shadow-qc-sm transition-all hover:shadow-qc-md"
                    >
                        <Link href={`/students/${studentId}`}>
                            Return to Student Profile
                            <ArrowRight weight="bold" size={18} />
                        </Link>
                    </Button>
                </div>
            </CardContent>
        </Card>
    );

    const activeIndex = stepIndex(step);

    return (
        <div className="container mx-auto max-w-3xl px-4 py-8 md:py-12">
            {activeIndex >= 0 && <ProgressRail activeIndex={activeIndex} />}
            <AnimatePresence mode="wait">
                <motion.div
                    key={step}
                    initial={variants.initial}
                    animate={variants.animate}
                    exit={variants.exit}
                    transition={{ duration: 0.25, ease: "easeInOut" }}
                >
                    {step === "intro" && renderIntro()}
                    {step === "personality" && renderPersonality()}
                    {step === "learning" && renderLearning()}
                    {step === "interests" && renderInterests()}
                    {step === "success" && renderSuccess()}
                </motion.div>
            </AnimatePresence>
        </div>
    );
}

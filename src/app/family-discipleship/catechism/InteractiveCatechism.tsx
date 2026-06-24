import React, { useState, useEffect, useRef, memo } from 'react';
import { Microphone, MicrophoneSlash, Check, X, ArrowClockwise, SpeakerHigh, SpeakerLow } from '@phosphor-icons/react/dist/ssr';
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

import { getStudentCatechismProgress, updateStudentCatechismProgress, markQuestionAsMastered } from "@/app/actions/student-catechism";

interface CatechismSpeechRecognitionAPI {
    continuous: boolean;
    interimResults: boolean;
    lang: string;
    onresult: ((event: CatechismSpeechRecognitionEvent) => void) | null;
    onerror: ((event: CatechismSpeechRecognitionErrorEvent) => void) | null;
    onend: (() => void) | null;
    start: () => void;
    stop: () => void;
}

interface CatechismSpeechRecognitionEvent {
    results: {
        [key: number]: {
            [key: number]: {
                transcript: string;
            };
        };
    };
}

interface CatechismSpeechRecognitionErrorEvent {
    error: string;
}

interface ProofTextItemProps {
    citationNumber: string;
    references: string[];
}

interface SubQuestion {
    number: string | number;
    question: string;
    answer: string;
}

interface CatechismQuestion {
    number?: string | number;
    question: string;
    answer: string;
    proofTexts?: Record<string, string[]>;
    subQuestions?: SubQuestion[];
    originalIndex?: number;
    subIndex?: number;
    isSubQuestion?: boolean;
    parentQuestion?: string;
}

interface ProgressItem {
    correct: boolean;
    score: number;
    userAnswer: string;
    attempts: number;
}

interface ComparisonResult {
    correct: boolean;
    score: number;
}

interface InteractiveCatechismProps {
    catechismData: CatechismQuestion[];
    title: string;
    studentId?: string | null;
    catechismId?: string | null;
}

// Memoized proof text item component
const ProofTextItem = memo<ProofTextItemProps>(({ citationNumber, references }) => {
    return (
        <div className="text-sm">
            <span className="font-medium text-qc-text-muted">[{citationNumber}]</span>
            <span className="ml-2 text-qc-text-primary">{references.join(', ')}</span>
        </div>
    );
}, (prevProps, nextProps) => {
    return (
        prevProps.citationNumber === nextProps.citationNumber &&
        prevProps.references.join(', ') === nextProps.references.join(', ')
    );
});

ProofTextItem.displayName = 'ProofTextItem';

const InteractiveCatechism = ({ catechismData, title, studentId, catechismId }: InteractiveCatechismProps) => {
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [userAnswer, setUserAnswer] = useState('');
    const [isListening, setIsListening] = useState(false);
    const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
    const [showAnswer, setShowAnswer] = useState(false);
    const [progress, setProgress] = useState<Record<number, ProgressItem>>({});
    const [mode, setMode] = useState<'speech' | 'typing'>('speech');
    const [currentAttempts, setCurrentAttempts] = useState(0);

    const recognitionRef = useRef<CatechismSpeechRecognitionAPI | null>(null);
    const synthRef = useRef<SpeechSynthesis | null>(null);

    const flattenCatechismData = (data: CatechismQuestion[]): CatechismQuestion[] => {
        const flattened: CatechismQuestion[] = [];

        data.forEach((item: CatechismQuestion, index: number) => {
            // Add main question
            flattened.push({
                ...item,
                originalIndex: index,
                isSubQuestion: false
            });

            // Add sub-questions if they exist (for Matthew Henry's catechism)
            if (item.subQuestions && item.subQuestions.length > 0) {
                item.subQuestions.forEach((subQ: SubQuestion, subIndex: number) => {
                    flattened.push({
                        number: subQ.number,
                        question: subQ.question,
                        answer: subQ.answer,
                        proofTexts: {},
                        originalIndex: index,
                        subIndex: subIndex,
                        isSubQuestion: true,
                        parentQuestion: item.question
                    });
                });
            }
        });

        return flattened;
    };

    const flattenedData = flattenCatechismData(catechismData);
    const currentQuestion = flattenedData[currentQuestionIndex];

    const updateServerProgress = async (newIndex: number) => {
        if (studentId && catechismId) {
            await updateStudentCatechismProgress(studentId, catechismId, newIndex);
        }
    };

    // Initial load of progress
    useEffect(() => {
        if (!studentId || !catechismId) return;

        const loadProgress = async () => {
            const progress = await getStudentCatechismProgress(studentId, catechismId);
            if (progress) {
                setCurrentQuestionIndex(progress.currentQuestionIndex);

                // Load mastered questions into local progress state
                if (progress.masteredQuestions && Array.isArray(progress.masteredQuestions)) {
                    const mastered = progress.masteredQuestions as string[];
                    const newProgress: Record<number, ProgressItem> = {};

                    // Identify indices for mastered questions
                    flattenedData.forEach((q, idx) => {
                        const qNum = q.number?.toString() || (idx + 1).toString();
                        if (mastered.includes(qNum)) {
                            newProgress[idx] = {
                                correct: true,
                                score: 1,
                                userAnswer: '(Previously Mastered)',
                                attempts: 1
                            };
                        }
                    });

                    if (Object.keys(newProgress).length > 0) {
                        setProgress(prev => ({ ...prev, ...newProgress }));
                    }
                }
            }
        };
        loadProgress();
        // eslint-disable-next-line react-hooks/exhaustive-deps -- loads saved progress on student/catechism change; flattenedData is derived fresh each render from catechismData (stable per catechism) and is read only to map mastered question numbers — depending on its per-render identity would refetch every render
    }, [studentId, catechismId, title]);

    // Initialize speech recognition
    useEffect(() => {
        if (typeof window !== 'undefined' && ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
            const SpeechRecognitionConstructor = window.SpeechRecognition || window.webkitSpeechRecognition;
            if (SpeechRecognitionConstructor) {
                recognitionRef.current = new SpeechRecognitionConstructor() as CatechismSpeechRecognitionAPI;
                if (recognitionRef.current) {
                    recognitionRef.current.continuous = false;
                    recognitionRef.current.interimResults = false;
                    recognitionRef.current.lang = 'en-US';

                    recognitionRef.current.onresult = (event: CatechismSpeechRecognitionEvent) => {
                        const transcript = event.results[0][0].transcript;
                        setUserAnswer(transcript);
                        setIsListening(false);
                    };

                    recognitionRef.current.onerror = (event: CatechismSpeechRecognitionErrorEvent) => {
                        console.error('Speech recognition error:', event.error);
                        setIsListening(false);
                    };

                    recognitionRef.current.onend = () => {
                        setIsListening(false);
                    };
                }
            }
        }

        // Initialize speech synthesis
        if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
            synthRef.current = window.speechSynthesis;
        }

        return () => {
            if (recognitionRef.current) {
                recognitionRef.current.stop();
            }
        };
    }, []);

    // Update current question index when data changes if necessary, or reset
    useEffect(() => {
        // We should just reset UI state.
        setUserAnswer('');
        setIsCorrect(null);
        setShowAnswer(false);
        setProgress({});
    }, [title]);

    const startListening = () => {
        if (recognitionRef.current && !isListening) {
            setIsListening(true);
            setUserAnswer('');
            recognitionRef.current.start();
        }
    };

    const stopListening = () => {
        if (recognitionRef.current && isListening) {
            recognitionRef.current.stop();
            setIsListening(false);
        }
    };

    const speakQuestion = () => {
        if (synthRef.current && currentQuestion) {
            const utterance = new SpeechSynthesisUtterance(currentQuestion.question);
            utterance.rate = 0.8;
            synthRef.current.speak(utterance);
        }
    };

    const speakAnswer = () => {
        if (synthRef.current && currentQuestion) {
            const utterance = new SpeechSynthesisUtterance(currentQuestion.answer);
            utterance.rate = 0.8;
            synthRef.current.speak(utterance);
        }
    };

    // Smart text comparison function
    const compareAnswers = (userAnswer: string, correctAnswer: string): ComparisonResult => {
        if (!userAnswer || !correctAnswer) {
            return { correct: false, score: 0 };
        }

        // Normalize both answers
        const normalize = (text: string): string => {
            return text
                .toLowerCase()
                .replace(/[^\w\s]/g, '') // Remove punctuation
                .replace(/\s+/g, ' ') // Normalize whitespace
                .trim();
        };

        const normalizedUser = normalize(userAnswer);
        const normalizedCorrect = normalize(correctAnswer);

        // Exact match
        if (normalizedUser === normalizedCorrect) {
            return { correct: true, score: 1.0 };
        }

        // Calculate similarity score
        const similarity = calculateSimilarity(normalizedUser, normalizedCorrect);

        // Consider correct if similarity is above 80%
        if (similarity >= 0.8) {
            return { correct: true, score: similarity };
        }

        // Check for key phrases if similarity is moderate
        if (similarity >= 0.6) {
            const keyPhrases = extractKeyPhrases(normalizedCorrect);
            const userHasKeyPhrases = keyPhrases.some(phrase =>
                normalizedUser.includes(phrase.toLowerCase())
            );

            if (userHasKeyPhrases) {
                return { correct: true, score: similarity };
            }
        }

        return { correct: false, score: similarity };
    };

    // Simple similarity calculation using Levenshtein distance
    const calculateSimilarity = (str1: string, str2: string): number => {
        const longer = str1.length > str2.length ? str1 : str2;
        const shorter = str1.length > str2.length ? str2 : str1;

        if (longer.length === 0) return 1.0;

        const distance = levenshteinDistance(longer, shorter);
        return (longer.length - distance) / longer.length;
    };

    const levenshteinDistance = (str1: string, str2: string): number => {
        const matrix = [];

        for (let i = 0; i <= str2.length; i++) {
            matrix[i] = [i];
        }

        for (let j = 0; j <= str1.length; j++) {
            matrix[0][j] = j;
        }

        for (let i = 1; i <= str2.length; i++) {
            for (let j = 1; j <= str1.length; j++) {
                if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + 1,
                        matrix[i][j - 1] + 1,
                        matrix[i - 1][j] + 1
                    );
                }
            }
        }

        return matrix[str2.length][str1.length];
    };

    // Extract key phrases from the correct answer
    const extractKeyPhrases = (text: string): string[] => {
        // Simple key phrase extraction - look for important theological terms
        const importantWords = [
            'god', 'jesus', 'christ', 'holy spirit', 'trinity', 'salvation',
            'faith', 'grace', 'sin', 'repentance', 'baptism', 'lord\'s supper',
            'church', 'scripture', 'bible', 'commandments', 'prayer', 'worship'
        ];

        return importantWords.filter(word => text.includes(word));
    };

    const checkAnswer = async () => {
        if (!userAnswer.trim()) return;

        const result = compareAnswers(userAnswer, currentQuestion.answer);

        const newAttempts = currentAttempts + 1;
        setCurrentAttempts(newAttempts);

        setIsCorrect(result.correct);
        setShowAnswer(true);

        // Update progress
        setProgress(prev => ({
            ...prev,
            [currentQuestionIndex]: {
                correct: result.correct,
                score: result.score,
                userAnswer: userAnswer,
                attempts: (prev[currentQuestionIndex]?.attempts || 0) + 1
            }
        }));

        // Persist mastery if correct AND answer was not shown
        // Strict Mastery Rule: "Mastery means that you typed or spoke the answer correctly while 'Show Answer' is not active."
        if (result.correct && !showAnswer && studentId && catechismId) {
            const qNum = currentQuestion.number?.toString() || (currentQuestionIndex + 1).toString();
            await markQuestionAsMastered(studentId, catechismId, qNum);
        }
    };

    const nextQuestion = () => {
        if (currentQuestionIndex < flattenedData.length - 1) {
            const newIndex = currentQuestionIndex + 1;
            setCurrentQuestionIndex(newIndex);
            updateServerProgress(newIndex);
            setUserAnswer('');
            setIsCorrect(null);
            setShowAnswer(false);
            setCurrentAttempts(0);
        }
    };

    const previousQuestion = () => {
        if (currentQuestionIndex > 0) {
            const newIndex = currentQuestionIndex - 1;
            setCurrentQuestionIndex(newIndex);
            updateServerProgress(newIndex);
            setUserAnswer('');
            setIsCorrect(null);
            setShowAnswer(false);
            setCurrentAttempts(0);
        }
    };

    const resetQuestion = () => {
        setUserAnswer('');
        setIsCorrect(null);
        setShowAnswer(false);
        setCurrentAttempts(0);
    };

    const getProgressStats = () => {
        const total = flattenedData.length;
        const completed = Object.keys(progress).length;
        const correct = Object.values(progress).filter((p: ProgressItem) => p.correct).length;
        const accuracy = completed > 0 ? (correct / completed * 100).toFixed(1) : '0';

        return { total, completed, correct, accuracy };
    };

    const stats = getProgressStats();

    if (!currentQuestion) return <div>Loading...</div>;

    return (
        <div className="max-w-4xl mx-auto px-3 md:px-4 py-4 md:py-6 lg:py-8">
            {/* Header */}
            <header className="mb-4 md:mb-6 lg:mb-8">
                <h1 className="text-2xl md:text-3xl font-bold text-qc-primary mb-2">
                    {title.replace('Interactive ', '')}
                </h1>

                {/* Progress Stats */}
                <div className="backdrop-blur-md bg-white/50 border border-qc-border-subtle rounded-lg p-3 md:p-4 mb-4 md:mb-6 shadow-sm">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 text-center">
                        <div>
                            <div className="text-xl md:text-2xl font-bold text-qc-primary">{stats.completed}</div>
                            <div className="text-xs md:text-sm text-qc-text-muted">Completed</div>
                        </div>
                        <div>
                            <div className="text-xl md:text-2xl font-bold text-qc-secondary">{stats.correct}</div>
                            <div className="text-xs md:text-sm text-qc-text-muted">Correct</div>
                        </div>
                        <div>
                            <div className="text-xl md:text-2xl font-bold text-qc-charcoal">{stats.accuracy}%</div>
                            <div className="text-xs md:text-sm text-qc-text-muted">Accuracy</div>
                        </div>
                        <div>
                            <div className="text-xl md:text-2xl font-bold text-qc-primary">{stats.total}</div>
                            <div className="text-xs md:text-sm text-qc-text-muted">Total</div>
                        </div>
                    </div>
                </div>
            </header>

            {/* Mode Toggle - Manila Envelope Style */}
            <div className="flex justify-center mb-0">
                <div className="relative">
                    <div className="flex">
                        <button
                            onClick={() => setMode('speech')}
                            className={cn(
                                "px-4 md:px-6 lg:px-8 py-2.5 md:py-3 font-medium transition-all duration-200 relative z-20 rounded-tl-lg rounded-tr-none [clip-path:polygon(0_0,calc(100%-15px)_0,100%_100%,15px_100%)] touch-manipulation min-h-[44px]",
                                mode === 'speech'
                                    ? 'bg-qc-primary text-white drop-shadow-md'
                                    : 'bg-qc-secondary/20 text-qc-primary hover:bg-qc-secondary/30'
                            )}
                        >
                            Speech
                        </button>
                        <button
                            onClick={() => setMode('typing')}
                            className={cn(
                                "px-4 md:px-6 lg:px-8 py-2.5 md:py-3 font-medium transition-all duration-200 relative z-20 rounded-tl-none rounded-tr-lg [clip-path:polygon(0_0,calc(100%-15px)_0,100%_100%,15px_100%)] touch-manipulation min-h-[44px]",
                                mode === 'typing'
                                    ? 'bg-qc-primary text-white drop-shadow-md'
                                    : 'bg-qc-secondary/20 text-qc-primary hover:bg-qc-secondary/30'
                            )}
                        >
                            Typing
                        </button>
                    </div>
                </div>
            </div>

            {/* Question Card */}
            <div className="backdrop-blur-md bg-white/70 border border-white/50 rounded-lg shadow-lg p-4 md:p-6 mb-4 md:mb-6 -mt-1 ring-1 ring-qc-border-subtle">
                <div className="flex items-center justify-between mb-3 md:mb-4">
                    <div className="flex items-center gap-3">
                        <h2 className="text-base md:text-lg lg:text-xl font-semibold text-qc-primary">
                            Question {currentQuestionIndex + 1} of {flattenedData.length}
                            {currentQuestion.isSubQuestion && (
                                <span className="ml-2 text-xs md:text-sm font-normal text-qc-text-muted">
                                    (Sub-question {currentQuestion.number})
                                </span>
                            )}
                        </h2>
                        {progress[currentQuestionIndex]?.userAnswer === '(Previously Mastered)' && (
                            <Badge variant="secondary" className="bg-qc-success/10 text-qc-success hover:bg-qc-success/20 border-qc-success/20">
                                <Check className="w-3 h-3 mr-1" />
                                Mastered
                            </Badge>
                        )}
                    </div>
                    <button
                        onClick={speakQuestion}
                        className="p-2 text-qc-text-muted hover:text-qc-primary transition-colors touch-manipulation min-h-[44px] min-w-[44px]"
                        title="Speak Question"
                    >
                        <SpeakerLow className="text-base md:text-lg" />
                    </button>
                </div>

                {currentQuestion.isSubQuestion && currentQuestion.parentQuestion && (
                    <div className="backdrop-blur-sm bg-qc-secondary/10 border border-qc-secondary/30 rounded-lg p-4 mb-4">
                        <p className="text-sm text-qc-secondary font-medium mb-1">Main Question:</p>
                        <p className="text-qc-primary">{currentQuestion.parentQuestion}</p>
                    </div>
                )}

                <p className="text-base md:text-lg text-qc-charcoal mb-3 md:mb-4 font-serif">{currentQuestion.question}</p>

                {/* Answer Input Area */}
                {mode === 'speech' ? (
                    <div className="space-y-3 md:space-y-4">
                        <div className="flex items-center justify-center">
                            <button
                                onClick={isListening ? stopListening : startListening}
                                className={cn(
                                    "w-14 h-14 md:w-16 md:h-16 rounded-full flex items-center justify-center transition-colors touch-manipulation",
                                    isListening
                                        ? 'bg-qc-error text-white hover:bg-qc-error/90 animate-pulse'
                                        : 'bg-qc-secondary text-white hover:bg-qc-secondary/90'
                                )}
                                title={isListening ? 'Stop Listening' : 'Start Speaking'}
                            >
                                {isListening ? <MicrophoneSlash className="text-lg md:text-xl" /> : <Microphone className="text-lg md:text-xl" />}
                            </button>
                        </div>

                        {isListening && (
                            <div className="flex items-center justify-center gap-2 text-sm md:text-base text-qc-primary">
                                Listening...
                            </div>
                        )}

                        {userAnswer && (
                            <div className="backdrop-blur-sm bg-white/50 border border-qc-border-subtle rounded-lg p-3 md:p-4">
                                <p className="text-xs md:text-sm text-qc-text-muted mb-2">You said:</p>
                                <p className="text-sm md:text-base text-qc-charcoal">{userAnswer}</p>
                            </div>
                        )}
                    </div>
                ) : (
                    <div>
                        <Textarea
                            value={userAnswer}
                            onChange={(e) => setUserAnswer(e.target.value)}
                            placeholder="Type your answer here..."
                            className="w-full h-28 md:h-32 resize-none text-sm md:text-base min-h-[44px] bg-white/50"
                        />
                    </div>
                )}

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 md:gap-4 mt-4 md:mt-6">
                    <Button
                        variant="outline"
                        onClick={() => setShowAnswer(!showAnswer)}
                        className="flex items-center justify-center gap-2"
                    >
                        {showAnswer ? 'Hide Answer' : 'Show Answer'}
                    </Button>

                    <div className="flex gap-2 md:gap-4">
                        <Button
                            onClick={checkAnswer}
                            disabled={!userAnswer.trim()}
                            className="flex items-center justify-center gap-2 bg-qc-primary hover:bg-qc-primary/90 text-white"
                        >
                            <Check className="w-4 h-4 md:w-5 md:h-5" />
                            <span className="hidden sm:inline">Check Answer</span>
                            <span className="sm:hidden">Check</span>
                        </Button>

                        <Button
                            variant="secondary"
                            onClick={resetQuestion}
                            title="Try Again"
                        >
                            <ArrowClockwise className="text-base md:text-lg" />
                        </Button>
                    </div>
                </div>

                {/* Answer Display */}
                {showAnswer && (
                    <div className={cn(
                        "rounded-lg p-4 mt-6 relative border",
                        isCorrect
                            ? 'backdrop-blur-sm bg-qc-success/10 border-qc-success/30'
                            : 'backdrop-blur-sm bg-qc-error/10 border-qc-error/30'
                    )}>
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                {isCorrect ? (
                                    <Check className="text-qc-success" />
                                ) : (
                                    <X className="text-qc-error" />
                                )}
                                <span className={cn(
                                    "font-medium",
                                    isCorrect ? 'text-qc-success' : 'text-qc-error'
                                )}>
                                    {isCorrect ? 'Correct!' : 'Not quite right'}
                                </span>
                                {isCorrect && (
                                    <span className="text-sm text-qc-text-muted">
                                        (Attempts: {currentAttempts})
                                    </span>
                                )}
                            </div>
                            <button
                                onClick={speakAnswer}
                                className="p-2 text-qc-text-muted hover:text-qc-primary transition-colors"
                                title="Hear Answer"
                            >
                                <SpeakerLow className="text-lg" />
                            </button>
                        </div>

                        <div className="mb-3">
                            <p className="text-sm text-qc-text-muted mb-1">Correct answer:</p>
                            <p className="text-qc-charcoal leading-relaxed">{currentQuestion.answer}</p>
                        </div>

                        {currentQuestion.proofTexts && Object.keys(currentQuestion.proofTexts).length > 0 && (
                            <div className="mb-3 pt-3 border-t border-dashed border-qc-border-subtle">
                                <p className="text-sm text-qc-text-muted mb-2">Scripture References:</p>
                                <div className="space-y-1">
                                    {Object.entries(currentQuestion.proofTexts).map(([citationNumber, references]) => (
                                        <ProofTextItem
                                            key={citationNumber}
                                            citationNumber={citationNumber}
                                            references={references as string[]}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

            </div>

            {/* Navigation */}
            <div className="flex justify-between gap-3 md:gap-4">
                <Button
                    variant="outline"
                    onClick={previousQuestion}
                    disabled={currentQuestionIndex === 0}
                    className="flex-1"
                >
                    Previous
                </Button>

                <Button
                    onClick={nextQuestion}
                    disabled={currentQuestionIndex === flattenedData.length - 1}
                    className="flex-1 bg-qc-secondary hover:bg-qc-secondary/90 text-white"
                >
                    Next
                </Button>
            </div>
        </div>
    );
};

export default InteractiveCatechism;

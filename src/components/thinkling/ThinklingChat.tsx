"use client";

import { useChat } from "@ai-sdk/react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { PaperPlaneRight, Robot, User as UserIcon, Trash } from "@phosphor-icons/react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";

import { ModeSelector } from "@/components/thinkling/ModeSelector";
import { ThinklingMode } from "@/lib/thinkling";

interface ThinklingChatProps {
    studentId: string;
    mode: string;
    onModeChange: (mode: ThinklingMode) => void;
}

export function ThinklingChat({ studentId, mode, onModeChange }: ThinklingChatProps) {
    const { messages, setMessages, sendMessage, status, stop } = useChat({
        onError: (e) => console.error("ThinklingChat API Error:", e),
        onFinish: (event) => {
            // The onFinish callback provides an event object containing the final UIMessage.
            const { message } = event;

            // Fallback: If for some reason the stream didn't update the UI, append the final message manually
            // This handles cases where intermediate state updates might have been suppressed
            if (message) {
                setMessages(currentMessages => {
                    // Check if message already exists (by ID) to avoid dupe
                    if (currentMessages.some(m => m.id === message.id)) return currentMessages;
                    return [...currentMessages, message];
                });
            }
        }
    });

    const [input, setInput] = useState("");
    const isLoading = status === "streaming" || status === "submitted";

    const scrollRef = useRef<HTMLDivElement>(null);

    // Scroll to bottom on new messages
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    // Clear chat when mode or student changes
    useEffect(() => {
        setMessages([]);
        setInput("");
    }, [mode, studentId, setMessages]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setInput(e.target.value);
    };

    const handleFormSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim()) return;

        const userMessage = input;
        setInput(""); // Clear input immediately

        // AI SDK v5: sendMessage takes a { text } message + per-call options (body merged into the request).
        await sendMessage(
            { text: userMessage },
            { body: { studentId, mode } },
        );
    };

    return (
        <Card className="h-[600px] flex flex-col border-qc-border-subtle shadow-lg">
            <CardHeader className="py-2 border-b bg-qc-parchment/50">
                <div className="flex justify-between items-center flex-wrap gap-2">
                    <div className="flex-1">
                        <ModeSelector selectedMode={mode} onSelectMode={onModeChange} />
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => setMessages([])} title="Clear Chat">
                        <Trash />
                    </Button>
                </div>
            </CardHeader>

            <CardContent className="flex-1 overflow-y-auto p-4 space-y-4" ref={scrollRef}>
                {messages.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center text-qc-text-muted opacity-70">
                        <Avatar className="h-20 w-20 mb-4 rounded-none border-0">
                            <AvatarImage src="/assets/branding/Inkling.png" alt="Thinkling" />
                            <AvatarFallback><Robot size={48} /></AvatarFallback>
                        </Avatar>
                        <p>How can I help you today?</p>
                    </div>
                )}

                {messages.map((m: any, index: number) => {
                    return (
                        <div key={`${m.id}-${index}`} className={`flex gap-3 ${m.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                            <Avatar className={`w-8 h-8 mt-1 ${m.role !== 'user' ? 'rounded-none border-0' : 'border'}`}>
                                {m.role !== 'user' && <AvatarImage src="/assets/branding/Inkling.png" alt="Thinkling" />}
                                <AvatarFallback className={m.role === 'user' ? 'bg-qc-primary text-white' : 'bg-qc-accent text-white'}>
                                    {m.role === 'user' ? <UserIcon /> : <Robot />}
                                </AvatarFallback>
                            </Avatar>

                            <div className={`p-3 rounded-lg max-w-[80%] ${m.role === 'user' ? 'bg-qc-primary text-white' : 'bg-qc-surface-raised text-qc-charcoal'}`}>
                                <div className="text-sm prose prose-sm max-w-none dark:prose-invert">
                                    <ReactMarkdown
                                        remarkPlugins={[remarkGfm, remarkBreaks, remarkMath]}
                                        rehypePlugins={[rehypeKatex]}
                                        components={{
                                            p: ({ node, ...props }) => <p className="mb-4 last:mb-0 leading-relaxed" {...props} />,
                                            ul: ({ node, ...props }) => <ul className="my-4 ml-6 list-disc space-y-2" {...props} />,
                                            ol: ({ node, ...props }) => <ol className="my-4 ml-6 list-decimal space-y-2" {...props} />,
                                            li: ({ node, ...props }) => <li className="pl-1" {...props} />,
                                            h1: ({ node, ...props }) => <h1 className="text-xl font-bold mt-6 mb-3" {...props} />,
                                            h2: ({ node, ...props }) => <h2 className="text-lg font-bold mt-5 mb-2" {...props} />,
                                            h3: ({ node, ...props }) => <h3 className="text-md font-bold mt-4 mb-2" {...props} />,
                                        }}
                                    >
                                        {m.content
                                            ? m.content
                                            : (m.parts && Array.isArray(m.parts))
                                                ? m.parts.map((p: any) => p.text).join('')
                                                : ''}
                                    </ReactMarkdown>
                                </div>
                            </div>
                        </div>
                    );
                })}

                {isLoading && (
                    <div className="flex gap-3">
                        <Avatar className="w-8 h-8 mt-1 border-0 rounded-none">
                            <AvatarImage src="/assets/branding/Inkling.png" alt="Thinkling" />
                            <AvatarFallback className="bg-qc-accent text-white"><Robot /></AvatarFallback>
                        </Avatar>
                        <div className="bg-qc-surface-raised rounded-lg px-4 py-2 text-sm text-qc-text-muted animate-pulse">
                            <div className="flex gap-1">
                                <span className="w-1.5 h-1.5 bg-qc-text-muted rounded-full animate-bounce"></span>
                                <span className="w-1.5 h-1.5 bg-qc-text-muted rounded-full animate-bounce delay-75"></span>
                                <span className="w-1.5 h-1.5 bg-qc-text-muted rounded-full animate-bounce delay-150"></span>
                            </div>
                        </div>
                    </div>
                )}
            </CardContent>

            <div className="p-4 border-t bg-white">
                <form onSubmit={handleFormSubmit} className="flex gap-2">
                    <Input
                        value={input}
                        onChange={handleInputChange}
                        placeholder="Type your message..."
                        className="flex-1"
                        disabled={isLoading}
                        autoFocus
                    />
                    <Button type="submit" size="icon" disabled={isLoading || !input.trim()}>
                        {isLoading ? <span className="w-4 h-4 border-2 border-white/50 border-t-white rounded-full animate-spin" /> : <PaperPlaneRight weight="fill" />}
                    </Button>
                </form>
            </div>
        </Card>
    );
}

"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
    Form,
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea"; // Assuming you have this or use Input
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { CircleNotch, Sparkle } from "@phosphor-icons/react";
// SECURITY: the SAME schema is enforced server-side in compileCurriculumAction (don't fork it).
import { curriculumSpecSchema as formSchema } from "@/lib/validation/curriculum-spec";

interface SpecFormProps {
    onSubmit: (values: z.infer<typeof formSchema>) => void;
    isLoading: boolean;
    initialContext?: {
        subject?: string;
        topic?: string;
        readingLevel?: string;
    };
}

export function SpecForm({ onSubmit, isLoading, initialContext }: SpecFormProps) {
    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema) as any,
        defaultValues: {
            subject: initialContext?.subject || "",
            topic: initialContext?.topic || "",
            readingLevel: initialContext?.readingLevel || "",
            durationDays: 1,
            constraints: {
                noDevices: false,
                lowPrep: false,
                groupWork: false,
                visualAid: true,
            },
        },
    });

    return (
        <Card className="w-full max-w-2xl border-2 border-qc-parchment-dark/50 bg-white/80 shadow-sm backdrop-blur-sm">
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-2xl text-qc-charcoal">
                    <Sparkle className="text-qc-primary" weight="fill" />
                    Curriculum Compiler
                </CardTitle>
                <CardDescription>
                    Define your constraints and specs. We'll engineer the rest.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="subject"
                                render={({ field }: { field: any }) => (
                                    <FormItem>
                                        <FormLabel>Subject</FormLabel>
                                        <FormControl>
                                            <Input placeholder="e.g. Science, History" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="readingLevel"
                                render={({ field }: { field: any }) => (
                                    <FormItem>
                                        <FormLabel>Target Audience</FormLabel>
                                        <FormControl>
                                            <Input placeholder="e.g. 5th Grade, High School" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <FormField
                            control={form.control}
                            name="topic"
                            render={({ field }: { field: any }) => (
                                <FormItem>
                                    <FormLabel>Specific Topic / Standard</FormLabel>
                                    <FormControl>
                                        <Input placeholder="e.g. The Life Cycle of a Frog" {...field} />
                                    </FormControl>
                                    <FormDescription>
                                        Be specific about what students should learn.
                                    </FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="durationDays"
                            render={({ field }: { field: any }) => (
                                <FormItem>
                                    <FormLabel>Duration (Days)</FormLabel>
                                    <FormControl>
                                        <Input type="number" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <div className="space-y-3 rounded-md border border-qc-parchment-dark/30 bg-qc-parchment/30 p-4">
                            <p className="text-base font-semibold">Engineering Constraints</p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <FormField
                                    control={form.control}
                                    name="constraints.noDevices"
                                    render={({ field }: { field: any }) => (
                                        <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                            <FormControl>
                                                <Checkbox
                                                    checked={field.value}
                                                    onCheckedChange={field.onChange}
                                                />
                                            </FormControl>
                                            <div className="space-y-1 leading-none">
                                                <FormLabel>No Devices Required</FormLabel>
                                                <FormDescription>
                                                    Entirely analog/printable.
                                                </FormDescription>
                                            </div>
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="constraints.lowPrep"
                                    render={({ field }: { field: any }) => (
                                        <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                            <FormControl>
                                                <Checkbox
                                                    checked={field.value}
                                                    onCheckedChange={field.onChange}
                                                />
                                            </FormControl>
                                            <div className="space-y-1 leading-none">
                                                <FormLabel>Low Prep</FormLabel>
                                                <FormDescription>
                                                    Uses common household items.
                                                </FormDescription>
                                            </div>
                                        </FormItem>
                                    )}
                                />
                            </div>
                        </div>

                        <Button type="submit" disabled={isLoading} className="w-full bg-gradient-to-r from-qc-accent to-qc-primary text-white font-bold hover:brightness-110">
                            {isLoading ? (
                                <>
                                    <CircleNotch className="mr-2 h-4 w-4 animate-spin" />
                                    Compiling...
                                </>
                            ) : (
                                "Compile Bundle"
                            )}
                        </Button>
                    </form>
                </Form>
            </CardContent>
        </Card>
    );
}

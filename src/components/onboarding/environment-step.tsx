"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { environmentStepSchema } from "@/lib/schemas/onboarding";
import { saveEnvironmentStep } from "@/server/actions/blueprint";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { z } from "zod";

type EnvironmentFormData = z.infer<typeof environmentStepSchema>;

// Predefined options for multi-select fields
const PHILOSOPHY_OPTIONS = [
  "Classical Education",
  "Charlotte Mason",
  "Montessori",
  "Unit Studies",
  "Project-Based Learning",
  "Traditional",
];

const RESOURCE_TYPES = [
  "Textbooks",
  "Workbooks",
  "Online Courses",
  "Videos",
  "Apps",
  "Hands-on Materials",
  "Library Books",
];

const GOALS = [
  "Academic Excellence",
  "Character Development",
  "Faith Integration",
  "Critical Thinking",
  "Creativity",
  "Independence",
];

const DEVICE_TYPES = [
  "Tablets",
  "Laptops",
  "Desktop Computers",
  "Smartphones",
  "No Devices",
];

const CHALLENGES = [
  "Time Management",
  "Motivation",
  "Learning Differences",
  "Multiple Ages",
  "Limited Resources",
  "Parent Involvement",
];

export function EnvironmentStep({
  initialData,
  onSaveComplete,
  isSaving,
  setIsSaving,
}: {
  initialData: any;
  onSaveComplete: () => void;
  isSaving: boolean;
  setIsSaving: (saving: boolean) => void;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
  } = useForm<EnvironmentFormData>({
    resolver: zodResolver(environmentStepSchema),
    defaultValues: {
      philosophyPreferences: [],
      resourceTypes: [],
      goals: [],
      deviceTypes: [],
      challenges: [],
      faithBackground: "",
    },
  });

  const toggleArrayValue = (
    field: keyof EnvironmentFormData,
    value: string
  ) => {
    const current = (watch(field) as string[]) || [];
    if (current.includes(value)) {
      setValue(field, current.filter((v) => v !== value) as any);
    } else {
      setValue(field, [...current, value] as any);
    }
  };

  const onSubmit = async (data: EnvironmentFormData) => {
    setIsSaving(true);
    try {
      // Identity is derived server-side from the session inside saveEnvironmentStep.
      await saveEnvironmentStep(data);
      onSaveComplete();
    } catch (error) {
      console.error("Failed to save environment step:", error);
      alert("Failed to save. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-8 animate-qc-fade-in">
      {/* Philosophy Preferences */}
      <div className="space-y-3">
        <Label className="text-lg font-display font-medium text-qc-primary">Educational Philosophy Preferences</Label>
        <div className="flex flex-wrap gap-3">
          {PHILOSOPHY_OPTIONS.map((option) => {
            const selected = (watch("philosophyPreferences") || []).includes(
              option
            );
            return (
              <Button
                key={option}
                type="button"
                variant={selected ? "default" : "outline"}
                size="lg"
                onClick={() => toggleArrayValue("philosophyPreferences", option)}
                className={`h-11 px-5 text-base rounded-full ${selected ? 'bg-qc-primary shadow-md' : 'border-qc-border-strong hover:bg-qc-parchment hover:text-qc-primary'}`}
              >
                {option}
              </Button>
            );
          })}
        </div>
      </div>

      {/* Resource Types */}
      <div className="space-y-3 pt-4 border-t border-qc-border-subtle">
        <Label className="text-lg font-display font-medium text-qc-primary">Preferred Resource Types</Label>
        <div className="flex flex-wrap gap-3">
          {RESOURCE_TYPES.map((type) => {
            const selected = (watch("resourceTypes") || []).includes(type);
            return (
              <Button
                key={type}
                type="button"
                variant={selected ? "default" : "outline"}
                size="lg"
                onClick={() => toggleArrayValue("resourceTypes", type)}
                className={`h-11 px-5 text-base rounded-full ${selected ? 'bg-qc-primary shadow-md' : 'border-qc-border-strong hover:bg-qc-parchment hover:text-qc-primary'}`}
              >
                {type}
              </Button>
            );
          })}
        </div>
      </div>

      {/* Goals */}
      <div className="space-y-3 pt-4 border-t border-qc-border-subtle">
        <Label className="text-lg font-display font-medium text-qc-primary">Educational Goals</Label>
        <div className="flex flex-wrap gap-3">
          {GOALS.map((goal) => {
            const selected = (watch("goals") || []).includes(goal);
            return (
              <Button
                key={goal}
                type="button"
                variant={selected ? "default" : "outline"}
                size="lg"
                onClick={() => toggleArrayValue("goals", goal)}
                className={`h-11 px-5 text-base rounded-full ${selected ? 'bg-qc-primary shadow-md' : 'border-qc-border-strong hover:bg-qc-parchment hover:text-qc-primary'}`}
              >
                {goal}
              </Button>
            );
          })}
        </div>
      </div>

      {/* Device Types */}
      <div className="space-y-3 pt-4 border-t border-qc-border-subtle">
        <Label className="text-lg font-display font-medium text-qc-primary">Available Devices</Label>
        <div className="flex flex-wrap gap-3">
          {DEVICE_TYPES.map((device) => {
            const selected = (watch("deviceTypes") || []).includes(device);
            return (
              <Button
                key={device}
                type="button"
                variant={selected ? "default" : "outline"}
                size="lg"
                onClick={() => toggleArrayValue("deviceTypes", device)}
                className={`h-11 px-5 text-base rounded-full ${selected ? 'bg-qc-primary shadow-md' : 'border-qc-border-strong hover:bg-qc-parchment hover:text-qc-primary'}`}
              >
                {device}
              </Button>
            );
          })}
        </div>
      </div>

      {/* Challenges */}
      <div className="space-y-3 pt-4 border-t border-qc-border-subtle">
        <Label className="text-lg font-display font-medium text-qc-primary">Current Challenges</Label>
        <div className="flex flex-wrap gap-3">
          {CHALLENGES.map((challenge) => {
            const selected = (watch("challenges") || []).includes(challenge);
            return (
              <Button
                key={challenge}
                type="button"
                variant={selected ? "default" : "outline"}
                size="lg"
                onClick={() => toggleArrayValue("challenges", challenge)}
                className={`h-11 px-5 text-base rounded-full ${selected ? 'bg-qc-primary shadow-md' : 'border-qc-border-strong hover:bg-qc-parchment hover:text-qc-primary'}`}
              >
                {challenge}
              </Button>
            );
          })}
        </div>
      </div>

      {/* Additional Faith Background Context */}
      <div className="space-y-3 pt-4 border-t border-qc-border-subtle">
        <Label htmlFor="faithBackground" className="text-base font-medium text-qc-primary">
          Additional Faith Background Context (Optional)
        </Label>
        <Input
          id="faithBackground"
          {...register("faithBackground")}
          placeholder="Any additional context about your faith background"
          className="h-12 text-base px-4 border-qc-border-strong"
        />
      </div>

      {/* Save Button */}
      <div className="flex justify-end pt-6">
        <Button type="submit" disabled={isSaving} className="hidden">
          {/* Hidden submit button to allow Enter key submission */}
          {isSaving ? "Saving..." : "Save & Complete"}
        </Button>
      </div>
    </form>
  );
}


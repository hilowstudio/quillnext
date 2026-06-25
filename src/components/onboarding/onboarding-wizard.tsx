"use client";

import { useState } from "react";
import { useQueryState } from "nuqs";
import { parseAsInteger } from "nuqs";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ClassroomStep } from "./classroom-step";
import { ScheduleStep } from "./schedule-step";
import { EnvironmentStep } from "./environment-step";
import { ArrowLeft } from "@/components/icons/arrow-left";
import { ArrowRight } from "@/components/icons/arrow-right";
import { CheckCircle } from "@/components/icons/check-circle";
import { AnimatePresence, motion } from "framer-motion";
import type { OnboardingData } from "./onboarding-types";

const stepParam = parseAsInteger.withDefault(1);

export function OnboardingWizard({
  initialStep: _initialStep,
  initialData,
}: {
  initialStep: number;
  initialData: OnboardingData;
}) {
  const [step, setStep] = useQueryState("step", stepParam);
  const [isSaving, setIsSaving] = useState(false);

  const steps = [
    { number: 1, title: "Classroom Setup", component: ClassroomStep },
    { number: 2, title: "Schedule", component: ScheduleStep },
    { number: 3, title: "Environment", component: EnvironmentStep },
  ];

  const currentStepIndex = Math.max(0, Math.min(step - 1, steps.length - 1));
  const CurrentStepComponent = steps[currentStepIndex]?.component;
  const isLastStep = currentStepIndex === steps.length - 1;
  const isFirstStep = currentStepIndex === 0;

  const handleNext = () => {
    if (isLastStep) {
      window.location.href = "/blueprint";
    } else {
      setStep(step + 1);
    }
  };

  const handlePrevious = () => {
    if (!isFirstStep) {
      setStep(step - 1);
    }
  };

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      {/* Progress Indicator */}
      <div className="mb-8">
        <div className="flex items-start justify-between">
          {steps.map((s, index) => (
            <div key={s.number} className="contents">
              <div className="flex flex-col items-center z-10">
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-full border-2 font-body text-sm font-medium transition-colors ${index < currentStepIndex
                    ? "border-qc-primary bg-qc-primary text-white"
                    : index === currentStepIndex
                      ? "border-qc-primary bg-white text-qc-primary"
                      : "border-qc-border-subtle bg-white text-qc-text-muted"
                    }`}
                >
                  {index < currentStepIndex ? (
                    <CheckCircle weight="fill" size={20} />
                  ) : (
                    s.number
                  )}
                </div>
                <p
                  className={`mt-2 text-xs font-body ${index === currentStepIndex
                    ? "text-qc-charcoal font-medium"
                    : "text-qc-text-muted"
                    }`}
                >
                  {s.title}
                </p>
              </div>
              {index < steps.length - 1 && (
                <div
                  className={`mx-4 mt-[19px] h-0.5 flex-1 ${index < currentStepIndex
                    ? "bg-qc-primary"
                    : "bg-qc-border-subtle"
                    }`}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Step Content */}
      <Card className="border-qc-border-subtle shadow-lg relative bg-white/80 backdrop-blur-sm">
        {/* Decorative top border */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-qc-primary via-qc-secondary to-qc-primary opacity-80" />

        <CardHeader className="pb-2 pt-8 px-8 md:px-12">
          <div className="flex flex-col space-y-2">
            <CardTitle className="font-display text-3xl text-qc-primary tracking-tight">
              {steps[currentStepIndex]?.title}
            </CardTitle>
            <CardDescription className="font-body text-base text-qc-text-muted">
              Step {step} of {steps.length}
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="px-8 md:px-12 pb-12 pt-6">
          <div className="min-h-[300px] mb-10">
            <AnimatePresence mode="wait">
              {CurrentStepComponent && (
                <motion.div
                  key={step}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3, ease: "easeInOut" }}
                >
                  <CurrentStepComponent
                    initialData={initialData}
                    onSaveComplete={handleNext}
                    isSaving={isSaving}
                    setIsSaving={setIsSaving}
                    formId={`onboarding-step-${step}`}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between border-t border-qc-border-subtle pt-8 mt-4">
            <Button
              variant="outline"
              onClick={handlePrevious}
              disabled={isFirstStep || isSaving}
              className="px-6 py-6 h-auto text-base hover:bg-qc-parchment hover:text-qc-primary transition-colors gap-2"
            >
              <ArrowLeft weight="bold" size={18} />
              Previous
            </Button>

            {!isLastStep && (
              <Button
                variant="default"
                type="submit"
                form={`onboarding-step-${step}`}
                disabled={isSaving}
                className="px-8 py-6 h-auto text-base bg-qc-primary hover:bg-qc-primary/90 shadow-md hover:shadow-lg transition-all gap-2"
              >
                Next Step
                <ArrowRight weight="bold" size={18} />
              </Button>
            )}

            {isLastStep && (
              <Button
                variant="default"
                type="submit"
                form={`onboarding-step-${step}`}
                disabled={isSaving}
                className="px-8 py-6 h-auto text-base bg-qc-secondary hover:bg-qc-secondary/90 text-qc-charcoal shadow-md hover:shadow-lg transition-all gap-2 font-medium"
              >
                Complete Setup
                <CheckCircle weight="fill" size={20} />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}


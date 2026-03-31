"use client";

import dynamic from "next/dynamic";
import { SpinnerGap } from "@phosphor-icons/react";

export const DynamicAssessmentWizard = dynamic(
    () => import("@/components/students/AssessmentWizard").then((mod) => mod.AssessmentWizard),
    {
        ssr: false,
        loading: () => (
            <div className="flex justify-center p-8">
                <SpinnerGap size={32} className="animate-spin text-qc-primary" />
            </div>
        ),
    }
);

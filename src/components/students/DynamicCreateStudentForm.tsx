"use client";

import dynamic from "next/dynamic";
import { SpinnerGap } from "@phosphor-icons/react";

export const DynamicCreateStudentForm = dynamic(
    () => import("@/components/students/CreateStudentForm").then((mod) => mod.CreateStudentForm),
    {
        ssr: false,
        loading: () => (
            <div className="flex justify-center p-8">
                <SpinnerGap size={32} className="animate-spin text-qc-primary" />
            </div>
        ),
    }
);

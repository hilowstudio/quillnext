"use client"

import * as React from "react"
import * as CheckboxPrimitive from "@radix-ui/react-checkbox"
import { Check } from "@phosphor-icons/react"

import { cn } from "@/lib/utils"

function Checkbox({
    className,
    ...props
}: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
    return (
        <CheckboxPrimitive.Root
            data-slot="checkbox"
            className={cn(
                "peer h-4 w-4 shrink-0 rounded-sm border border-qc-border-strong ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-qc-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-qc-primary data-[state=checked]:text-white data-[state=checked]:border-qc-primary transition-all duration-200",
                className
            )}
            {...props}
        >
            <CheckboxPrimitive.Indicator
                className={cn("flex items-center justify-center text-current")}
            >
                <Check weight="bold" className="h-3 w-3" />
            </CheckboxPrimitive.Indicator>
        </CheckboxPrimitive.Root>
    )
}

export { Checkbox }

"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

const TabsContext = React.createContext<{
    value: string
    onValueChange: (value: string) => void
} | null>(null)

function Tabs({
    className,
    value,
    defaultValue,
    onValueChange,
    ...props
}: React.ComponentProps<"div"> & {
    value?: string
    defaultValue?: string
    onValueChange?: (value: string) => void
}) {
    const [internalValue, setInternalValue] = React.useState(defaultValue || "")

    const controlledValue = value !== undefined ? value : internalValue
    const handleValueChange = React.useCallback(
        (newValue: string) => {
            if (value === undefined) {
                setInternalValue(newValue)
            }
            onValueChange?.(newValue)
        },
        [value, onValueChange]
    )

    return (
        <TabsContext.Provider value={{ value: controlledValue, onValueChange: handleValueChange }}>
            <div data-slot="tabs" className={cn("w-full", className)} {...props} />
        </TabsContext.Provider>
    )
}

function TabsList({ className, ...props }: React.ComponentProps<"div">) {
    return (
        <div
            data-slot="tabs-list"
            className={cn(
                "inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground",
                className
            )}
            {...props}
        />
    )
}

function TabsTrigger({
    className,
    value,
    ...props
}: React.ComponentProps<"button"> & { value: string }) {
    const context = React.useContext(TabsContext)
    const isActive = context?.value === value

    return (
        <button
            data-slot="tabs-trigger"
            className={cn(
                "inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
                isActive && "bg-background text-foreground shadow-sm",
                className
            )}
            onClick={() => context?.onValueChange(value)}
            {...props}
        />
    )
}

function TabsContent({
    className,
    value,
    ...props
}: React.ComponentProps<"div"> & { value: string }) {
    const context = React.useContext(TabsContext)
    const isSelected = context?.value === value

    if (!isSelected) return null

    return (
        <div
            data-slot="tabs-content"
            className={cn(
                "mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                className
            )}
            {...props}
        />
    )
}

export { Tabs, TabsList, TabsTrigger, TabsContent }

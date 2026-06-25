"use client"

import * as React from "react"
import { Check, ChevronsUpDown, Plus } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"

export interface ComboboxOption {
    label: string
    value: string
}

interface ComboboxWithCreateProps {
    options: ComboboxOption[]
    value?: string
    onSelect: (value: string) => void
    onCreate?: (value: string) => void
    placeholder?: string
    emptyText?: string
    createText?: string
    className?: string
    disabled?: boolean
}

export function ComboboxWithCreate({
    options,
    value,
    onSelect,
    onCreate,
    placeholder = "Select option...",
    emptyText = "No option found.",
    createText = "Create",
    className,
    disabled = false
}: ComboboxWithCreateProps) {
    const [open, setOpen] = React.useState(false)
    const [inputValue, setInputValue] = React.useState("")

    const selectedOption = options.find((option) => option.value === value)

    const handleCreate = () => {
        if (onCreate && inputValue) {
            onCreate(inputValue)
            setOpen(false)
            setInputValue("")
        }
    }

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className={cn("w-full justify-between", className)}
                    disabled={disabled}
                >
                    {selectedOption ? selectedOption.label : value || placeholder}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                <Command>
                    <CommandInput
                        placeholder={placeholder}
                        onValueChange={setInputValue}
                    />
                    <CommandList>
                        <CommandEmpty>
                            {onCreate ? (
                                <div className="p-2">
                                    <p className="text-sm text-muted-foreground mb-2">{emptyText}</p>
                                    <Button
                                        size="sm"
                                        className="w-full justify-start gap-2"
                                        onClick={handleCreate}
                                    >
                                        <Plus className="h-4 w-4" />
                                        {createText} &quot;{inputValue}&quot;
                                    </Button>
                                </div>
                            ) : (
                                emptyText
                            )}
                        </CommandEmpty>
                        <CommandGroup>
                            {options.map((option) => (
                                <CommandItem
                                    key={option.value}
                                    value={option.label} // Use label for searching
                                    onSelect={() => {
                                        onSelect(option.value === value ? "" : option.value)
                                        setOpen(false)
                                    }}
                                >
                                    <Check
                                        className={cn(
                                            "mr-2 h-4 w-4",
                                            value === option.value ? "opacity-100" : "opacity-0"
                                        )}
                                    />
                                    {option.label}
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    )
}

"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface UrlInputProps {
    value: string;
    onChange: (val: string) => void;
}

export function UrlInput({ value, onChange }: UrlInputProps) {
    return (
        <div className="space-y-2">
            <Label>Web Article URL</Label>
            <Input
                placeholder="https://example.com/article"
                value={value}
                onChange={(e) => onChange(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">Original content will be fetched and synthesized.</p>
        </div>
    );
}

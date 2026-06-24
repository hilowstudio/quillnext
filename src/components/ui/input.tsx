import * as React from "react";
import { cn } from "@/lib/utils";

export type InputProps = React.ComponentProps<"input">;

function Input({ className, type, ...props }: InputProps) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "flex h-10 w-full rounded-qc-md border border-qc-border-subtle bg-white px-3 py-2 font-body text-sm text-qc-charcoal placeholder:text-qc-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-qc-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  );
}

export { Input };

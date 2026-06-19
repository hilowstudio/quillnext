import * as React from "react";
import { cn } from "@/lib/utils";

export interface LabelProps
  extends React.ComponentProps<"label"> {}

function Label({ className, ...props }: LabelProps) {
  return (
    <label
      data-slot="label"
      className={cn(
        "font-body text-sm font-medium text-qc-charcoal leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
        className
      )}
      {...props}
    />
  );
}

export { Label };

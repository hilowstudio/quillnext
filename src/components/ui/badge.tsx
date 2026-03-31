import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-qc-primary text-white hover:bg-qc-primary/80",
        secondary:
          "border-transparent bg-qc-secondary text-qc-charcoal hover:bg-qc-secondary/80",
        outline:
          "text-qc-charcoal border-qc-border-subtle bg-transparent hover:bg-qc-parchment",
        success:
          "border-qc-success-border bg-qc-success-bg text-qc-success-text",
        warning:
          "border-qc-warning-border bg-qc-warning-bg text-qc-warning-text",
        error:
          "border-qc-error-border bg-qc-error-bg text-qc-error-text",
        info:
          "border-qc-info-border bg-qc-info-bg text-qc-info-text",
        ai:
          "border-violet-300 bg-violet-50 text-violet-700 dark:border-violet-600 dark:bg-violet-950 dark:text-violet-300",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };


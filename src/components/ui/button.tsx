import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-qc-md font-body text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-qc-primary focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-qc-primary !text-[#ffffff] shadow-qc-sm hover:opacity-90",
        secondary: "bg-qc-secondary text-qc-charcoal shadow-qc-sm hover:opacity-90",
        outline:
          "border border-qc-border-strong bg-transparent text-qc-charcoal hover:bg-qc-warm-stone",
        ghost: "hover:bg-qc-warm-stone text-qc-charcoal",
        link: "text-qc-primary underline-offset-4 hover:underline",
        destructive: "bg-qc-error text-white shadow-qc-sm hover:opacity-90",
      },
      size: {
        default: "h-11 px-4 py-2",
        sm: "h-10 px-3",
        lg: "h-12 px-8",
        icon: "h-11 w-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ComponentProps<"button">,
  VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

function Button({ className, variant, size, asChild = false, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };


import * as React from "react";

import { cn } from "../lib/utils";
import { VariantProps, cva } from "class-variance-authority";

const inputVariants = cva(
  "flex h-10 w-full super-ellipse focus-visible:ring-2 focus-visible:ring-accent rounded-lg! bg-foreground/5  px-3 py-2 text-foreground file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-foreground/50 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 text-sm",
  {
    variants: {
      variant: {
        default: "bg-foreground/5",
        secondary: "bg-foreground/10",
      },
      size: {
        default: "h-10",
        sm: "h-8",
        lg: "h-12",
      },
    },
    defaultVariants: {
      size: "default",
      variant: "default",
    },
  }
);

type InputProps = Omit<React.ComponentProps<"input">, "size"> & VariantProps<typeof inputVariants>;

const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, type, variant, size, ...props }, ref) => {
  return (
    <input
      type={type}
      className={cn(inputVariants({ variant, size }), className)}
      ref={ref}
      {...props}
    />
  );
});
Input.displayName = "Input";

export { Input };

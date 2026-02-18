import { type VariantProps, cva } from "class-variance-authority";
import type * as React from "react";

import { XIcon } from "lucide-react";
import { cn } from "../lib/utils";

const badgeVariants = cva(
  "inline-flex items-center font-[380] opacity-90 hover:opacity-100  px-2 py-1 text-xs rounded-md transition-colors",
  {
    variants: {
      variant: {
        ghost: "bg-transparent text-foreground hover:bg-foreground/10",
        default:
          "bg-primary dark:bg-background dark:ring-1 dark:ring-foreground/10 text-background dark:text-foreground",
        bordered:
          "bg-base-background hover:bg-base-background text-foreground/90 hover:text-foreground [&_[data-shortcut='true']]:text-foreground/50 shadow-[0_0_0px_1px_rgba(0,0,0,0.04),0_0.85px_0.5px_0px_rgba(255,255,255)_inset,0px_1px_2px_0px_rgba(0,0,0,0.09),0px_0px_0px_1px_rgba(0,0,0,0.06)] dark:shadow-[0_0_0px_1px_rgba(255,255,255,0.15)_inset,0_0.85px_0.5px_0px_rgba(255,255,255,0.05)_inset,0px_1px_2px_0px_rgba(0,0,0,0.09),0px_0px_0px_1px_rgba(0,0,0,0.06)]",
        backdrop:
          "bg-popover/60 dark:bg-white/20 !text-white hover:bg-popover/70 dark:hover:bg-white/30 [&_svg]:!text-white backdrop-blur-[24px]",
        secondary: "bg-foreground/10 text-foreground",
        accent: " bg-accent/20 text-accent-foreground",
        destructive: "bg-destructive/40 text-foreground/80 ",
        outline: "text-foreground bg-secondary ring-1 ring-foreground/10 dark:ring-inset",
        purple: "bg-purple-500/40 text-foreground/80 dark:bg-purple-500/80 dark:text-foreground",
        blue: "bg-blue-500/40 text-foreground/80 dark:bg-blue-500/80 dark:text-foreground",
        green: "bg-green-500/40 text-foreground/80 dark:bg-green-500/80 dark:text-foreground",
        yellow: "bg-yellow-500/40 text-foreground/80 dark:bg-yellow-500/80 dark:text-foreground",
        orange: "bg-orange-500/40 text-foreground/80 dark:bg-orange-500/80 dark:text-foreground",
        red: "bg-red-500/40 text-foreground/80 dark:bg-red-500/80 dark:text-foreground",
        gray: "bg-gray-500/40 text-foreground/80 dark:bg-gray-500/80 dark:text-foreground",
        indigo: "bg-indigo-500/40 text-foreground/80 dark:bg-indigo-500/80 dark:text-foreground",
      },
      size: {
        sm: "px-2 h-5 text-xs has-[.close-icon]:pr-1",
        md: "px-2 h-6 shrink-0 text-xs has-[.close-icon]:pr-1",
        lg: "px-2.5  h-7 shrink-0 text-sm has-[.close-icon]:pr-1.5",
      },
      rounded: {
        default: "rounded-md",
        full: "rounded-full",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "md",
      rounded: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {
  size?: "sm" | "md" | "lg";
  rounded?: "default" | "full";
  onClose?: () => void;
}

function Badge({ className, variant, size, rounded, onClose, ...props }: BadgeProps) {
  return (
    <div
      className={cn(
        badgeVariants({ variant, size, rounded }),
        "flex items-center gap-1",
        className
      )}
      {...props}
    >
      {props.children}
      {onClose && (
        <div
          className="size-4.5 cursor-pointer flex items-center justify-center close-icon opacity-80 hover:opacity-100  rounded-full"
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
        >
          <XIcon className="size-3 text-inherit" />
        </div>
      )}
    </div>
  );
}

export { Badge, badgeVariants };

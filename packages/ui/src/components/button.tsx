"use client";
import { Slot } from "@radix-ui/react-slot";
import { type VariantProps, cva } from "class-variance-authority";
import * as React from "react";

import { Spinner1Icon } from "../icons";
import { cn } from "../lib/utils";
import { Shortcut } from "./shortcut";
import { Tooltip, TooltipContent, TooltipTrigger } from "./tooltip";

const buttonVariants = cva(
  "inline-flex items-center [corner-shape:superellipse(1.3)] cursor-pointer justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-[transform] disabled:pointer-events-none disabled:opacity-20 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 [&_svg]:shrink-0 outline-none  aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40",
  {
    variants: {
      variant: {
        brand:
          "bg-brand text-brand-foreground [&_.shortcut]:text-brand-foreground/70 hover:bg-brand/90",
        default:
          "bg-primary text-primary-foreground [&_.shortcut]:text-primary-foreground/70	 hover:bg-primary/90",
        accent: "bg-accent text-white [&_.shortcut]:text-white/70 hover:bg-accent-hover",
        accent2: "bg-accent-2 text-white [&_.shortcut]:text-white/70 hover:opacity-80",
        destructive:
          "bg-destructive text-white [&_.shortcut]:text-white/70 hover:bg-destructive-hover",
        bordered:
          "bg-base-background dark:bg-secondary hover:bg-base-background dark:hover:bg-secondary text-foreground/90 hover:text-foreground [&_[data-shortcut='true']]:text-foreground/50 shadow-button dark:hover:opacity-80",
        secondary:
          "bg-foreground/10 text-foreground/90 hover:text-foreground hover:bg-foreground/15 [&_[data-shortcut='true']]:text-foreground/50",
        ghost:
          "hover:bg-foreground/10 hover:text-foreground text-foreground/60 [&_[data-shortcut='true']]:text-foreground/50 dark:hover:bg-foreground/15",
        link: "text-primary underline-offset-4 hover:underline [&_[data-shortcut='true']]:text-primary/50",
        dark: "bg-dark text-white hover:bg-dark/90 [&_svg]:text-white",
        backdrop:
          "bg-popover/70 text-white hover:bg-popover/80 [&_svg]:text-white backdrop-blur-[24px]",
        "backdrop-light":
          "bg-white/90 text-black hover:bg-white/80 [&_svg]:text-black backdrop-blur-[24px]",
      },
      size: {
        default: "h-7.5 px-3 py-2 has-[>svg]:px-2 rounded-lg! text-sm",
        sm: "h-7 rounded-lg! gap-1.5 px-2.5 has-[>svg]:px-2 text-xs",
        lg: "h-10 rounded-xl! px-4 has-[>svg]:px-3 text-sm",
        xs: "h-6 rounded-md! gap-1.5 px-2.5 has-[>svg]:px-2 text-xs",
        icon: "size-8 rounded-md",
        "icon-sm": "size-7 rounded-md",
        "icon-xs": "size-6 rounded-md",
      },
      rounded: {
        default: "rounded-lg",
        lg: "rounded-lg",
        full: "rounded-full [corner-shape:round]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
      rounded: "default",
    },
  }
);

const Button = React.forwardRef<
  HTMLButtonElement,
  React.ComponentProps<"button"> &
    VariantProps<typeof buttonVariants> & {
      asChild?: boolean;
      loading?: boolean;
      tooltip?: string | React.ReactNode;
      tooltipSide?: "top" | "bottom" | "left" | "right";
      tooltipAlign?: "start" | "center" | "end";
      tooltipOffset?: number;
      tooltipClassName?: string;
      shortcut?: string;
      shortcutOnHover?: boolean;
    }
>(
  (
    {
      className,
      variant,
      size,
      asChild = false,
      loading = false,
      rounded = "default",
      tooltip,
      tooltipAlign = "center",
      tooltipSide = "top",
      tooltipClassName,
      shortcut,
      shortcutOnHover = false,
      tooltipOffset = 4,
      ...props
    },
    ref
  ) => {
    const Comp = asChild ? Slot : "button";

    const ButtonComp = (
      <Comp
        ref={ref}
        data-slot="button"
        className={cn(buttonVariants({ variant, size, rounded, className }), "group/button")}
        {...props}
      >
        {loading && <Spinner1Icon className="size-4 animate-spin" />}
        {!loading && props.children}
        {shortcut && !loading && (
          <Shortcut
            shortcut={shortcut}
            className={cn(
              "ml-auto mr-1 shrink-0",
              shortcutOnHover &&
                "group-hover/button:opacity-100 opacity-0 transition-opacity duration-100"
            )}
          />
        )}
      </Comp>
    );

    if (tooltip) {
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex">{ButtonComp}</span>
          </TooltipTrigger>
          <TooltipContent
            sideOffset={tooltipOffset}
            side={tooltipSide}
            align={tooltipAlign}
            className={tooltipClassName}
          >
            {tooltip}
          </TooltipContent>
        </Tooltip>
      );
    }

    return ButtonComp;
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };

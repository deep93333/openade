"use client";

import * as SeparatorPrimitive from "@radix-ui/react-separator";
import * as React from "react";

import { cn } from "../lib/utils";

const Separator = React.forwardRef<
  React.ElementRef<typeof SeparatorPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SeparatorPrimitive.Root>
>(({ className, orientation = "horizontal", decorative = true, ...props }, ref) => (
  <SeparatorPrimitive.Root
    ref={ref}
    decorative={decorative}
    orientation={orientation}
    className={cn(
      "shrink-0 bg-foreground/10",
      orientation === "horizontal" ? "h-[1px] w-full" : "h-full w-[1px]",
      className
    )}
    {...props}
  />
));

const VerticalSeparator = ({ className }: { className?: string }) => {
  return (
    <div
      className={cn(
        "h-full w-[2.2px] shadow-[1.2px_0px_0.5px_0px_rgba(0,0,0,0.06)_inset,-0.8px_0px_0px_0px_rgba(255,255,255,1)_inset]",
        className
      )}
    />
  );
};

const HorizontalSeparator = ({ className }: { className?: string }) => {
  return (
    <div
      className={cn(
        "h-[2.2px] w-full shadow-[0px_1.2px_0.5px_0px_rgba(0,0,0,0.06)_inset,0px_-0.8px_0px_0px_rgba(255,255,255,1)_inset]",
        className
      )}
    />
  );
};

Separator.displayName = SeparatorPrimitive.Root.displayName;

export { HorizontalSeparator, Separator, VerticalSeparator };

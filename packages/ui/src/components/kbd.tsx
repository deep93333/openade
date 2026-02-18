import * as React from "react";
import { cn } from "../lib/utils";

type KbdProps = {
  className?: string;
  children: React.ReactNode;
};

const Kbd = React.forwardRef<HTMLSpanElement, KbdProps>(({ className, children }, ref) => {
  return (
    <span
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center min-w-[1.5rem] h-5 px-1.5 rounded text-xs font-medium border border-foreground/20 bg-foreground/5",
        className
      )}
    >
      {children}
    </span>
  );
});

Kbd.displayName = "Kbd";

export { Kbd };

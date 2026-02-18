import * as React from "react";
import { getShortcutDisplayKeys } from "../lib/shortcut";
import { cn } from "../lib/utils";

type ShortcutProps = {
  shortcut: string;
  className?: string;
  usePill?: boolean;
};

const Shortcut = React.forwardRef<HTMLDivElement, ShortcutProps>(
  ({ shortcut, className, usePill = false }, ref) => {
    const keys = getShortcutDisplayKeys(shortcut);
    const glyphKeys = new Set(["⌘", "⌃", "⇧", "⌥", "␣", "↵", "⇥"]);

    return (
      <div
        ref={ref}
        className={cn(
          "inline-flex shortcut items-center gap-0.5 text-xs font-medium text-foreground/90",
          className
        )}
      >
        {usePill ? (
          <div className="rounded-md gap-0.5 bg-foreground/10 px-1.5 py-0.5 flex items-center">
            {keys.map((key, index) => (
              <span
                key={`${key}-${index}`}
                className={glyphKeys.has(key) ? "text-inherit" : "font-medium"}
              >
                {key}
              </span>
            ))}
          </div>
        ) : (
          keys.map((key, index) => (
            <span
              key={`${key}-${index}`}
              className={glyphKeys.has(key) ? "text-inherit" : "font-medium"}
            >
              {key}
            </span>
          ))
        )}
      </div>
    );
  }
);

Shortcut.displayName = "Shortcut";

export { Shortcut };

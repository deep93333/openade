"use client";

import * as PopoverPrimitive from "@radix-ui/react-popover";
import * as React from "react";

import { cn } from "../lib/utils";

const PopoverContext = React.createContext<{ modal?: boolean }>({});

const Popover = ({
  modal,
  ...props
}: React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Root>) => {
  return (
    <PopoverContext.Provider value={{ modal }}>
      <PopoverPrimitive.Root modal={modal} {...props} />
    </PopoverContext.Provider>
  );
};
Popover.displayName = PopoverPrimitive.Root.displayName;

const PopoverTrigger = PopoverPrimitive.Trigger;

const PopoverContent = React.forwardRef<
  React.ElementRef<typeof PopoverPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content> & {
    zIndex?: number | string;
    containerId?: string;
  }
>(({ className, align = "center", sideOffset = 4, zIndex, containerId, ...props }, ref) => {
  const { modal } = React.useContext(PopoverContext);

  return (
    <PopoverPrimitive.Content
      ref={ref}
      align={align}
      sideOffset={sideOffset}
      className={cn(
        "w-80 mt-1 rounded-xl bg-background/95 dark:bg-tertiary/95 backdrop-blur-xl p-4 text-foreground shadow-popover data-[state=open]:animate-fade-in data-[state=closed]:animate-fade-out",
        modal ? "z-modal-dropdown" : "z-[var(--z-popover)]",
        className
      )}
      style={
        zIndex !== undefined
          ? { zIndex: typeof zIndex === "number" ? zIndex : undefined }
          : undefined
      }
      {...props}
    />
  );
});
PopoverContent.displayName = PopoverPrimitive.Content.displayName;

export { Popover, PopoverContent, PopoverTrigger };

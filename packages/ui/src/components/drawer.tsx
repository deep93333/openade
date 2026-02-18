"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import * as React from "react";
import { cn } from "../lib/utils";

type DrawerProps = {
  children: React.ReactNode;
  side?: "left" | "right" | "top" | "bottom";
  size?: "sm" | "md" | "lg" | "xl" | "full";
  className?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

type DrawerContextType = {
  side: "left" | "right" | "top" | "bottom";
  size: "sm" | "md" | "lg" | "xl" | "full";
  isExpanded: boolean;
  setIsExpanded: (expanded: boolean) => void;
};

const DrawerContext = React.createContext<DrawerContextType | null>(null);

const useDrawerContext = () => {
  const context = React.useContext(DrawerContext);
  if (!context) {
    throw new Error("Drawer components must be used within a Drawer");
  }
  return context;
};

function Drawer({
  children,
  side = "right",
  size = "md",
  className,
  open,
  onOpenChange,
}: DrawerProps) {
  const [isExpanded, setIsExpanded] = React.useState(false);

  const contextValue = React.useMemo(
    () => ({
      side,
      size,
      isExpanded,
      setIsExpanded,
    }),
    [side, size, isExpanded]
  );

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DrawerContext.Provider value={contextValue}>
        <div className={cn("drawer-container", className)}>{children}</div>
      </DrawerContext.Provider>
    </DialogPrimitive.Root>
  );
}

function DrawerTrigger({
  children,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return (
    <DialogPrimitive.Trigger data-slot="drawer-trigger" {...props}>
      {children}
    </DialogPrimitive.Trigger>
  );
}

function DrawerContent({
  children,
  className,
  showCloseButton = true,
  overlayClassName,
  fullscreen = false,
  zIndex,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  showCloseButton?: boolean;
  overlayClassName?: string;
  fullscreen?: boolean;
  zIndex?: number | string;
}) {
  const { side, size } = useDrawerContext();
  const overlayZIndex =
    zIndex !== undefined ? (typeof zIndex === "number" ? zIndex - 1 : zIndex) : undefined;
  const contentZIndex = zIndex !== undefined ? zIndex : undefined;

  const getSizeClasses = () => {
    if (fullscreen) {
      return "w-screen h-screen";
    }
    switch (size) {
      case "sm":
        return side === "left" || side === "right" ? "w-80" : "h-80";
      case "md":
        return side === "left" || side === "right" ? "w-96" : "h-96";
      case "lg":
        return side === "left" || side === "right" ? "w-[32rem]" : "h-[32rem]";
      case "xl":
        return side === "left" || side === "right" ? "w-[40rem]" : "h-[40rem]";
      case "full":
        return side === "left" || side === "right" ? "w-screen" : "h-screen";
      default:
        return side === "left" || side === "right" ? "w-96" : "h-96";
    }
  };

  const getPositionClasses = () => {
    if (fullscreen || size === "full") {
      switch (side) {
        case "left":
          return "left-0 top-0 h-screen";
        case "right":
          return "right-0 top-0 h-screen";
        case "top":
          return "top-0 left-0 w-screen";
        case "bottom":
          return "bottom-0 left-0 w-screen";
        default:
          return "right-0 top-0 h-screen";
      }
    }

    switch (side) {
      case "left":
        return "left-2 top-2 h-[calc(100%-1rem)]";
      case "right":
        return "right-2 top-2 h-[calc(100%-1rem)]";
      case "top":
        return "top-2 left-2 w-[calc(100%-1rem)]";
      case "bottom":
        return "bottom-2 left-2 w-[calc(100%-1rem)]";
      default:
        return "right-2 top-2 h-[calc(100%-1rem)]";
    }
  };

  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay asChild>
        <div
          className={cn(
            "fixed inset-0 p-4 bg-zinc-600/50",
            fullscreen && "inset-0",
            overlayZIndex !== undefined ? `z-[${overlayZIndex}]` : "z-[var(--z-drawer)]",
            overlayClassName
          )}
          style={
            overlayZIndex !== undefined
              ? { zIndex: typeof overlayZIndex === "number" ? overlayZIndex : undefined }
              : undefined
          }
        />
      </DialogPrimitive.Overlay>
      <DialogPrimitive.Content
        asChild
        className={cn((fullscreen || size === "full") && "inset-0 w-screen h-screen")}
      >
        <div
          data-slot="drawer-content"
          className={cn(
            "fixed bg-base-background flex flex-col shadow-xl p-0 overflow-hidden",
            fullscreen || size === "full" ? "rounded-none" : "rounded-lg",
            contentZIndex !== undefined ? `z-[${contentZIndex}]` : "z-[var(--z-drawer)]",
            getSizeClasses(),
            getPositionClasses(),
            (fullscreen || size === "full") && side === "right" && "origin-right",
            (fullscreen || size === "full") && side === "left" && "origin-left",
            (fullscreen || size === "full") && side === "top" && "origin-top",
            (fullscreen || size === "full") && side === "bottom" && "origin-bottom",
            fullscreen && "w-[100dvw] h-[100dvh]",
            className
          )}
          style={
            contentZIndex !== undefined
              ? { zIndex: typeof contentZIndex === "number" ? contentZIndex : undefined }
              : undefined
          }
        >
          {children}
        </div>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

function DrawerHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="drawer-header"
      className={cn("flex flex-col gap-2 p-1 border-b border-foreground/5", className)}
      {...props}
    />
  );
}

function DrawerTitle({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="drawer-title"
      className={cn("text-lg font-semibold leading-none tracking-tight", className)}
      {...props}
    />
  );
}

function DrawerDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="drawer-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  );
}

function DrawerBody({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="drawer-body"
      className={cn("flex-1 overflow-y-auto p-0 pt-0 bg-base-background", className)}
      {...props}
    />
  );
}

function DrawerFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="drawer-footer"
      className={cn("flex flex-col gap-2 p-6 pt-4", className)}
      {...props}
    />
  );
}

function DrawerClose({ children, ...props }: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return (
    <DialogPrimitive.Close data-slot="drawer-close" {...props}>
      {children}
    </DialogPrimitive.Close>
  );
}

function DrawerExpand({ children, className, ...props }: React.ComponentProps<"button">) {
  const { isExpanded, setIsExpanded } = useDrawerContext();

  return (
    <button
      data-slot="drawer-expand"
      className={cn(
        "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none ring-offset-background",
        "hover:bg-accent hover:text-accent-foreground h-10 py-2 px-4",
        className
      )}
      onClick={() => setIsExpanded(!isExpanded)}
      {...props}
    >
      {children}
    </button>
  );
}

function DrawerExpandableContent({ children, className, ...props }: React.ComponentProps<"div">) {
  const { isExpanded } = useDrawerContext();

  return (
    <div
      data-slot="drawer-expandable-content"
      className={cn(
        "overflow-hidden transition-all duration-300 ease-out",
        isExpanded ? "max-h-screen opacity-100" : "max-h-0 opacity-0",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export {
  Drawer,
  DrawerBody,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerExpand,
  DrawerExpandableContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
};

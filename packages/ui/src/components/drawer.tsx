"use client";

import { DrawerPreview as BaseDrawer } from "@base-ui/react/drawer";
import * as React from "react";
import { cn } from "../lib/utils";

type SwipeDirection = "up" | "down" | "left" | "right";

type DrawerProps = {
  children: React.ReactNode;
  className?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  swipeDirection?: SwipeDirection;
  modal?: boolean;
  resizable?: boolean;
  minWidth?: number;
  maxWidth?: number;
  defaultWidth?: number;
  minHeight?: number;
  maxHeight?: number;
  defaultHeight?: number;
};

type DrawerContextType = {
  swipeDirection: SwipeDirection;
  resizable: boolean;
  width: number;
  height: number;
  startResize: (e: React.MouseEvent) => void;
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
  className,
  open,
  onOpenChange,
  swipeDirection = "right",
  modal = true,
  resizable = false,
  minWidth = 320,
  maxWidth = 1200,
  defaultWidth = 640,
  minHeight = 200,
  maxHeight = 800,
  defaultHeight = 400,
}: DrawerProps) {
  const [width, setWidth] = React.useState(defaultWidth);
  const [height, setHeight] = React.useState(defaultHeight);
  const isResizing = React.useRef(false);

  const handleResize = React.useCallback(
    (e: MouseEvent) => {
      if (!isResizing.current) return;
      if (swipeDirection === "left" || swipeDirection === "right") {
        const next =
          swipeDirection === "right"
            ? Math.min(maxWidth, Math.max(minWidth, window.innerWidth - e.clientX))
            : Math.min(maxWidth, Math.max(minWidth, e.clientX));
        setWidth(next);
      } else {
        const next =
          swipeDirection === "down"
            ? Math.min(maxHeight, Math.max(minHeight, window.innerHeight - e.clientY))
            : Math.min(maxHeight, Math.max(minHeight, e.clientY));
        setHeight(next);
      }
    },
    [swipeDirection, minWidth, maxWidth, minHeight, maxHeight]
  );

  const stopResize = React.useCallback(() => {
    isResizing.current = false;
    document.removeEventListener("mousemove", handleResize);
    document.removeEventListener("mouseup", stopResize);
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  }, [handleResize]);

  const startResize = React.useCallback(
    (e: React.MouseEvent) => {
      if (!resizable) return;
      e.preventDefault();
      e.stopPropagation();
      isResizing.current = true;
      document.body.style.cursor =
        swipeDirection === "left" || swipeDirection === "right" ? "col-resize" : "row-resize";
      document.body.style.userSelect = "none";
      document.addEventListener("mousemove", handleResize);
      document.addEventListener("mouseup", stopResize);
    },
    [resizable, swipeDirection, handleResize, stopResize]
  );

  React.useEffect(() => {
    return () => {
      document.removeEventListener("mousemove", handleResize);
      document.removeEventListener("mouseup", stopResize);
    };
  }, [handleResize, stopResize]);

  const contextValue = React.useMemo(
    () => ({
      swipeDirection,
      resizable,
      width,
      height,
      startResize,
    }),
    [swipeDirection, resizable, width, height, startResize]
  );

  return (
    <BaseDrawer.Root open={open} onOpenChange={onOpenChange} swipeDirection={swipeDirection} modal={modal}>
      <DrawerContext.Provider value={contextValue}>
        <div className={cn("drawer-container", className)}>{children}</div>
      </DrawerContext.Provider>
    </BaseDrawer.Root>
  );
}

function DrawerTrigger({
  children,
  className,
  ...props
}: React.ComponentProps<typeof BaseDrawer.Trigger>) {
  return (
    <BaseDrawer.Trigger data-slot="drawer-trigger" className={className} {...props}>
      {children}
    </BaseDrawer.Trigger>
  );
}

type DrawerContentProps = React.ComponentPropsWithoutRef<"div"> & {
  overlayClassName?: string;
};

function DrawerContent({ children, className, overlayClassName, ...props }: DrawerContentProps) {
  const { swipeDirection, resizable, width, height, startResize } = useDrawerContext();

  const getPositionClasses = () => {
    switch (swipeDirection) {
      case "left":
        return "left-2 top-2 h-[calc(100%-1rem)] items-stretch justify-start";
      case "right":
        return "right-2 top-2 h-[calc(100%-1rem)] items-stretch justify-end";
      case "up":
        return "top-2 left-2 right-2 w-[calc(100%-1rem)] items-start justify-center";
      case "down":
        return "bottom-2 left-2 right-2 w-[calc(100%-1rem)] items-end justify-center";
      default:
        return "right-2 top-2 h-[calc(100%-1rem)] items-stretch justify-end";
    }
  };

  const getResizeHandleClasses = () => {
    switch (swipeDirection) {
      case "left":
        return "absolute right-0 top-0 h-full w-1.5 cursor-col-resize touch-none border-r border-transparent hover:border-border hover:bg-secondary/50";
      case "right":
        return "absolute left-0 top-0 h-full w-1.5 cursor-col-resize touch-none border-l border-transparent hover:border-border hover:bg-secondary/50";
      case "up":
        return "absolute bottom-0 left-0 w-full h-1.5 cursor-row-resize touch-none border-b border-transparent hover:border-border hover:bg-secondary/50";
      case "down":
        return "absolute top-0 left-0 w-full h-1.5 cursor-row-resize touch-none border-t border-transparent hover:border-border hover:bg-secondary/50";
      default:
        return "";
    }
  };

  const getPopupTransform = () => {
    switch (swipeDirection) {
      case "right":
        return "[transform:translateX(var(--drawer-swipe-movement-x))]";
      case "left":
        return "[transform:translateX(var(--drawer-swipe-movement-x))]";
      case "down":
        return "[transform:translateY(var(--drawer-swipe-movement-y))]";
      case "up":
        return "[transform:translateY(var(--drawer-swipe-movement-y))]";
      default:
        return "";
    }
  };

  const getStartingEndingTransform = () => {
    switch (swipeDirection) {
      case "right":
        return "data-[starting-style]:[transform:translateX(100%)] data-[ending-style]:[transform:translateX(100%)]";
      case "left":
        return "data-[starting-style]:[transform:translateX(-100%)] data-[ending-style]:[transform:translateX(-100%)]";
      case "down":
        return "data-[starting-style]:[transform:translateY(100%)] data-[ending-style]:[transform:translateY(100%)]";
      case "up":
        return "data-[starting-style]:[transform:translateY(-100%)] data-[ending-style]:[transform:translateY(-100%)]";
      default:
        return "";
    }
  };

  const sizeStyle = resizable
    ? swipeDirection === "left" || swipeDirection === "right"
      ? { width: `${width}px` }
      : { height: `${height}px` }
    : undefined;

  return (
    <BaseDrawer.Portal>
      <BaseDrawer.Backdrop
        className={cn(
          "fixed inset-0 z-[var(--z-drawer)] min-h-dvh bg-foreground/20",
          "opacity-[calc(0.2*(1-var(--drawer-swipe-progress)))]",
          "transition-opacity duration-[450ms] ease-[cubic-bezier(0.32,0.72,0,1)]",
          "data-[swiping]:duration-0",
          "data-[starting-style]:opacity-0 data-[ending-style]:opacity-0",
          "data-[ending-style]:duration-[calc(var(--drawer-swipe-strength)*400ms)]",
          overlayClassName
        )}
      />
      <BaseDrawer.Viewport
        className={cn("fixed inset-0 z-[var(--z-drawer)] flex p-0", getPositionClasses())}
      >
        <BaseDrawer.Popup
          className={cn(
            "relative flex flex-col bg-background shadow-popover dark:ring-1 dark:ring-foreground/10 overflow-hidden rounded-xl",
            "transition-transform duration-[450ms] ease-[cubic-bezier(0.32,0.72,0,1)]",
            "data-[swiping]:select-none",
            "data-[ending-style]:duration-[calc(var(--drawer-swipe-strength)*400ms)]",
            getPopupTransform(),
            getStartingEndingTransform(),
            className
          )}
          style={sizeStyle}
          {...props}
        >
          {resizable && (
            <div
              className={cn("z-10", getResizeHandleClasses())}
              onMouseDown={startResize}
              aria-hidden
            />
          )}
          {children}
        </BaseDrawer.Popup>
      </BaseDrawer.Viewport>
    </BaseDrawer.Portal>
  );
}

function DrawerHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="drawer-header"
      className={cn("flex shrink-0 flex-col gap-2 p-1 border-b border-foreground/5", className)}
      {...props}
    />
  );
}

function DrawerTitle({ className, ...props }: React.ComponentProps<typeof BaseDrawer.Title>) {
  return (
    <BaseDrawer.Title
      data-slot="drawer-title"
      className={cn("text-lg font-semibold leading-none tracking-tight", className)}
      {...props}
    />
  );
}

function DrawerDescription({
  className,
  ...props
}: React.ComponentProps<typeof BaseDrawer.Description>) {
  return (
    <BaseDrawer.Description
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
      className={cn("flex-1 min-h-0 overflow-y-auto p-0 pt-0 bg-background", className)}
      {...props}
    />
  );
}

function DrawerFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="drawer-footer"
      className={cn("flex shrink-0 flex-col gap-2 p-6 pt-4", className)}
      {...props}
    />
  );
}

function DrawerClose({ children, ...props }: React.ComponentProps<typeof BaseDrawer.Close>) {
  return (
    <BaseDrawer.Close data-slot="drawer-close" {...props}>
      {children}
    </BaseDrawer.Close>
  );
}

function DrawerHandle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="drawer-handle"
      className={cn("mx-auto h-1 w-12 shrink-0 rounded-full bg-muted-foreground/30", className)}
      {...props}
    />
  );
}

export {
  Drawer,
  DrawerBody,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHandle,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
  useDrawerContext,
};

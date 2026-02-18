"use client";
import { Dialog as BaseDialog } from "@base-ui/react/dialog";
import * as React from "react";

import { CircleXIcon, XIcon } from "../icons";
import { cn } from "../lib/utils";

type DialogOptionsContextValue = {
  setDisablePointerDismissal: (value: boolean | undefined) => void;
};

const DialogOptionsContext = React.createContext<DialogOptionsContextValue | null>(null);

function useDialogOptions() {
  return React.useContext(DialogOptionsContext);
}

function Dialog({
  onOpenChange,
  modal = true,
  ...props
}: React.ComponentProps<typeof BaseDialog.Root>) {
  const [disablePointerDismissalFromContent, setDisablePointerDismissal] = React.useState<
    boolean | undefined
  >(undefined);
  const contextValue = React.useMemo<DialogOptionsContextValue>(
    () => ({ setDisablePointerDismissal }),
    []
  );

  const handleOpenChange = React.useCallback(
    (
      open: boolean,
      eventDetails: Parameters<
        NonNullable<React.ComponentProps<typeof BaseDialog.Root>["onOpenChange"]>
      >[1]
    ) => {
      onOpenChange?.(open, eventDetails);
      if (!open) {
        setTimeout(() => {
          document.body.style.pointerEvents = "";
        }, 0);
      }
    },
    [onOpenChange]
  );

  return (
    <DialogOptionsContext.Provider value={contextValue}>
      <BaseDialog.Root
        data-slot="dialog"
        modal={modal}
        onOpenChange={handleOpenChange}
        {...props}
      />
    </DialogOptionsContext.Provider>
  );
}

function DialogTrigger(props: React.ComponentProps<typeof BaseDialog.Trigger>) {
  return <BaseDialog.Trigger data-slot="dialog-trigger" {...props} />;
}

function DialogPortal(props: React.ComponentProps<typeof BaseDialog.Portal>) {
  return <BaseDialog.Portal data-slot="dialog-portal" {...props} />;
}

function DialogClose(props: React.ComponentProps<typeof BaseDialog.Close>) {
  return <BaseDialog.Close data-slot="dialog-close" {...props} />;
}

type DialogOverlayProps = React.ComponentProps<typeof BaseDialog.Backdrop> & {
  zIndex?: number | string;
};

function DialogOverlay({ className, zIndex, ...props }: DialogOverlayProps) {
  return (
    <BaseDialog.Backdrop
      data-slot="dialog-overlay"
      className={cn(
        "fixed inset-0 min-h-dvh bg-black/15 dark:bg-black/50 transition-opacity duration-200 data-ending-style:opacity-0 data-starting-style:opacity-0 supports-[-webkit-touch-callout:none]:absolute",
        zIndex !== undefined ? `z-[${zIndex}]` : "z-[var(--z-dialog)]",
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
}

type DialogContentProps = React.ComponentProps<typeof BaseDialog.Popup> & {
  showCloseButton?: boolean;
  overlayClassName?: string;
  zIndex?: number | string;
  disableOutsidePointerEvents?: boolean;
};

function DialogContent({
  className,
  children,
  showCloseButton = true,
  overlayClassName,
  zIndex,
  disableOutsidePointerEvents,
  ...props
}: DialogContentProps) {
  const options = useDialogOptions();
  React.useEffect(() => {
    options?.setDisablePointerDismissal(disableOutsidePointerEvents);
  }, [options, disableOutsidePointerEvents]);

  const overlayZIndex =
    zIndex !== undefined ? (typeof zIndex === "number" ? zIndex - 1 : zIndex) : undefined;
  const contentZIndex = zIndex !== undefined ? zIndex : undefined;

  return (
    <BaseDialog.Portal data-slot="dialog-portal">
      <DialogOverlay className={overlayClassName} zIndex={overlayZIndex} />
      <BaseDialog.Popup
        data-slot="dialog-content"
        className={cn(
          "bg-background fixed top-[50%] left-[50%] w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 p-6 rounded-2xl shadow-popover flex flex-col transition-all duration-200 data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0",
          contentZIndex !== undefined ? `z-[${contentZIndex}]` : "z-[var(--z-dialog)]",
          className
        )}
        style={
          contentZIndex !== undefined
            ? { zIndex: typeof contentZIndex === "number" ? contentZIndex : undefined }
            : undefined
        }
        {...props}
      >
        {children}
        {showCloseButton && (
          <BaseDialog.Close
            data-slot="dialog-close"
            className="absolute size-7 top-1.5 super-ellipse cursor-pointer right-1.5 flex items-center justify-center rounded-lg opacity-70 transition-opacity hover:opacity-100 hover:bg-foreground/10 data-[state=open]:bg-foreground/30 data-[state=open]:text-foreground/30 disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-6"
          >
            <CircleXIcon className="size-5 text-foreground/50" />
            <span className="sr-only">Close</span>
          </BaseDialog.Close>
        )}
      </BaseDialog.Popup>
    </BaseDialog.Portal>
  );
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("flex flex-row gap-2 text-center sm:text-left", className)}
      {...props}
    />
  );
}

function DialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn("flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", className)}
      {...props}
    />
  );
}

function DialogTitle({ className, ...props }: React.ComponentProps<typeof BaseDialog.Title>) {
  return (
    <BaseDialog.Title
      data-slot="dialog-title"
      className={cn("text-base leading-none font-medium text-foreground", className)}
      {...props}
    />
  );
}

function DialogBody({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-body"
      className={cn("flex flex-col gap-2 flex-1", className)}
      {...props}
    />
  );
}

function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof BaseDialog.Description>) {
  return (
    <BaseDialog.Description
      data-slot="dialog-description"
      className={cn("text-muted-foreground text-sm font-normal", className)}
      {...props}
    />
  );
}

export {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
};

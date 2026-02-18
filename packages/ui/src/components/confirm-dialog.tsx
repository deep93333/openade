"use client";
import * as React from "react";

import { cn } from "../lib/utils";
import { Button } from "./button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./dialog";

type ConfirmButtonProps = {
  children: React.ReactElement;
  title?: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm?: () => void | Promise<void>;
  onCancel?: () => void;
  variant?: "default" | "destructive";
  loading?: boolean;
  disabled?: boolean;
  className?: string;
};

const ConfirmDialog = React.forwardRef<HTMLButtonElement, ConfirmButtonProps>(
  (
    {
      children,
      title = "Are you sure?",
      description,
      confirmText = "Confirm",
      cancelText = "Cancel",
      onConfirm,
      onCancel,
      variant = "default",
      loading = false,
      disabled = false,
      className,
      ...props
    },
    _ref
  ) => {
    const [isOpen, setIsOpen] = React.useState(false);
    const [isLoading, setIsLoading] = React.useState(false);

    const handleConfirm = async () => {
      if (onConfirm) {
        setIsLoading(true);
        try {
          await onConfirm();
          setIsOpen(false);
        } finally {
          setIsLoading(false);
        }
      }
    };

    const handleCancel = () => {
      if (onCancel) {
        onCancel();
      }
      setIsOpen(false);
    };

    const isConfirmLoading = loading || isLoading;

    return (
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger onClick={(e) => e.stopPropagation()}>{children}</DialogTrigger>
        <DialogContent className={cn("sm:max-w-[300px] flex flex-col gap-2 p-3", className)}>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>
          <DialogDescription>{description}</DialogDescription>
          <DialogFooter>
            <Button
              type="button"
              className="w-full"
              variant="secondary"
              onClick={handleCancel}
              disabled={isConfirmLoading}
            >
              {cancelText}
            </Button>
            <Button
              type="button"
              className="w-full"
              variant={variant === "destructive" ? "destructive" : "default"}
              onClick={handleConfirm}
              loading={isConfirmLoading}
              disabled={disabled || isConfirmLoading}
            >
              {confirmText}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }
);

ConfirmDialog.displayName = "ConfirmDialog";

export { ConfirmDialog };
export type { ConfirmButtonProps };

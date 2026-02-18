"use client";
import * as AvatarPrimitive from "@radix-ui/react-avatar";
import * as React from "react";

import { cn } from "../lib/utils";

const Avatar = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Root>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Root
    ref={ref}
    className={cn(
      "relative p-0.5 flex h-7 w-7 shrink-0 bg-base-background ring-shadow shadow-sm overflow-hidden rounded-full",
      className
    )}
    {...props}
  />
));
Avatar.displayName = AvatarPrimitive.Root.displayName;

const AvatarImage = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Image>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Image>
>(({ className, ...props }, ref) => (
  <div className="aspect-square h-fit w-fit overflow-hidden rounded-full relative">
    <AvatarPrimitive.Image ref={ref} className={cn("w-full h-full", className)} {...props} />
    <div className="absolute inset-0 w-full h-full rounded-full border border-foreground/10"></div>
  </div>
));
AvatarImage.displayName = AvatarPrimitive.Image.displayName;

const AvatarFallback = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Fallback>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Fallback>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Fallback
    ref={ref}
    className={cn(
      "flex h-full w-full bg-secondary items-center justify-center rounded-full text-xs text-foreground/60 ring-1 ring-foreground/20 dark:ring-inset",
      className
    )}
    {...props}
  />
));
AvatarFallback.displayName = AvatarPrimitive.Fallback.displayName;

export { Avatar, AvatarFallback, AvatarImage };

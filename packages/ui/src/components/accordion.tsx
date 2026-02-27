"use client";

import * as AccordionPrimitive from "@radix-ui/react-accordion";
import * as React from "react";

import { ChevronDownIcon } from "../icons";
import { cn } from "../lib/utils";

const Accordion = AccordionPrimitive.Root;

const AccordionItem = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Item>
>(({ className, ...props }, ref) => (
  <AccordionPrimitive.Item ref={ref} className={cn("border-b border-foreground/10", className)} {...props} />
));
AccordionItem.displayName = "AccordionItem";

const AccordionTrigger = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Trigger> & { asChild?: boolean }
>(({ asChild, className, children, ...props }, ref) => {
  const triggerClassName = cn(
    "flex flex-1 items-center justify-between py-4 font-medium transition-all hover:underline [&[data-state=open]>svg]:rotate-180",
    className
  );
  const icon = <ChevronDownIcon className="size-3! shrink-0 text-muted-foreground transition-transform duration-200" />;

  if (asChild && React.isValidElement(children)) {
    return (
      <AccordionPrimitive.Header className="flex w-full">
        <AccordionPrimitive.Trigger asChild ref={ref} className={triggerClassName} {...props}>
          {React.cloneElement(children as React.ReactElement<{ className?: string; children?: React.ReactNode }>, {
            className: cn((children as React.ReactElement<{ className?: string }>).props.className, triggerClassName),
            children: (
              <>
                {(children as React.ReactElement<{ children?: React.ReactNode }>).props.children}
                {icon}
              </>
            ),
          })}
        </AccordionPrimitive.Trigger>
      </AccordionPrimitive.Header>
    );
  }

  return (
    <AccordionPrimitive.Header className="flex w-full">
      <AccordionPrimitive.Trigger ref={ref} className={triggerClassName} {...props}>
        {children}
        {icon}
      </AccordionPrimitive.Trigger>
    </AccordionPrimitive.Header>
  );
});
AccordionTrigger.displayName = AccordionPrimitive.Trigger.displayName;

const AccordionContent = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <AccordionPrimitive.Content
    ref={ref}
    className="overflow-hidden text-sm transition-all data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down"
    {...props}
  >
    <div className={cn("pb-4 pt-0", className)}>{children}</div>
  </AccordionPrimitive.Content>
));

AccordionContent.displayName = AccordionPrimitive.Content.displayName;

export { Accordion, AccordionContent, AccordionItem, AccordionTrigger };

"use client";

import { ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import * as React from "react";
import { type DayButton, DayPicker } from "react-day-picker";
import { Button, buttonVariants } from "../components/button";
import { cn } from "../lib/utils";

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  captionLayout = "label",
  buttonVariant = "ghost",
  formatters,
  components,
  cellSize = "2rem",
  ...props
}: React.ComponentProps<typeof DayPicker> & {
  buttonVariant?: React.ComponentProps<typeof Button>["variant"];
  cellSize?: string;
}) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      style={{ "--cell-size": cellSize } as React.CSSProperties}
      className={cn(
        "group/calendar p-1 [[data-slot=card-content]_&]:bg-transparent [[data-slot=popover-content]_&]:bg-transparent",
        String.raw`rtl:**:[.rdp-button\_next>svg]:rotate-180`,
        String.raw`rtl:**:[.rdp-button\_previous>svg]:rotate-180`,
        className
      )}
      captionLayout={captionLayout}
      formatters={{
        formatMonthDropdown: (date) => date.toLocaleString("default", { month: "short" }),
        ...formatters,
      }}
      classNames={{
        root: "w-fit",
        months: "relative flex flex-col gap-1",
        month: "flex flex-col gap-1",
        nav: "absolute inset-x-0 top-0 flex items-center justify-between",
        button_previous: cn(
          buttonVariants({ variant: buttonVariant }),
          "size-(--cell-size) select-none p-0 aria-disabled:opacity-50"
        ),
        button_next: cn(
          buttonVariants({ variant: buttonVariant }),
          "size-(--cell-size) select-none p-0 aria-disabled:opacity-50"
        ),
        month_caption: "flex h-(--cell-size) w-full items-center justify-center",
        dropdowns:
          "flex h-(--cell-size) w-full items-center justify-center gap-1.5 text-sm font-medium",
        dropdown_root:
          "has-focus:border-ring border-input shadow-xs has-focus:ring-ring/50 has-focus:ring-[3px] relative rounded-md border",
        dropdown: "bg-popover absolute inset-0 opacity-0",
        caption_label: cn(
          "select-none font-medium",
          captionLayout === "label"
            ? "text-sm"
            : "[&>svg]:text-muted-foreground flex h-8 items-center gap-1 rounded-md pl-2 pr-1 text-sm [&>svg]:size-3.5"
        ),
        table: "border-collapse",
        weekdays: "flex gap-2",
        weekday:
          "text-muted-foreground flex-1 min-w-7 select-none text-[0.8rem] font-normal text-center",
        week: "flex gap-2",
        week_number_header: "flex-1 min-w-7 select-none",
        week_number: "text-muted-foreground select-none text-[0.8rem]",
        day: "group/day relative flex-1 min-w-7 aspect-square select-none p-0 text-center",
        range_start: "bg-rose-500/75 rounded-l-md",
        range_middle: "rounded-none",
        range_end: "bg-rose-500/75 rounded-r-md",
        today: "",
        outside: "text-muted-foreground aria-selected:text-muted-foreground",
        disabled: "text-muted-foreground opacity-50",
        hidden: "invisible",
        ...classNames,
      }}
      components={{
        Root: ({ className, rootRef, ...props }) => {
          return <div data-slot="calendar" ref={rootRef} className={cn(className)} {...props} />;
        },
        Chevron: ({ className, orientation, ...props }) => {
          if (orientation === "left") {
            return <ChevronLeftIcon className={cn("size-4", className)} {...props} />;
          }

          if (orientation === "right") {
            return <ChevronRightIcon className={cn("size-4", className)} {...props} />;
          }

          return <ChevronDownIcon className={cn("size-4", className)} {...props} />;
        },
        DayButton: CalendarDayButton,
        WeekNumber: ({ children, ...props }) => {
          return (
            <td {...props}>
              <div className="flex size-full items-center justify-center text-center">
                {children}
              </div>
            </td>
          );
        },
        ...components,
      }}
      {...props}
    />
  );
}

function CalendarDayButton({
  className,
  day,
  modifiers,
  ...props
}: React.ComponentProps<typeof DayButton>) {
  const ref = React.useRef<HTMLButtonElement>(null);
  React.useEffect(() => {
    if (modifiers.focused) ref.current?.focus();
  }, [modifiers.focused]);

  return (
    <Button
      ref={ref}
      variant="ghost"
      size="icon"
      data-day={day.date.toLocaleDateString()}
      data-today={modifiers.today}
      data-selected-single={
        modifiers.selected &&
        !modifiers.range_start &&
        !modifiers.range_end &&
        !modifiers.range_middle
      }
      data-range-start={modifiers.range_start}
      data-range-end={modifiers.range_end}
      data-range-middle={modifiers.range_middle}
      className={cn(
        "data-[today=true]:bg-rose-500/50 data-[selected-single=true]:bg-rose-500 data-[selected-single=true]:text-white data-[range-middle=true]:bg-rose-500/15 data-[range-middle=true]:text-foreground data-[range-start=true]:bg-rose-500 data-[range-start=true]:text-white data-[range-end=true]:bg-rose-500 data-[range-end=true]:text-white group-data-[focused=true]/day:border-ring group-data-[focused=true]/day:ring-ring/50 flex size-full flex-col font-normal leading-none data-[range-end=true]:rounded-md data-[range-middle=true]:rounded-none data-[range-start=true]:rounded-md group-data-[focused=true]/day:relative group-data-[focused=true]/day:z-10 group-data-[focused=true]/day:ring-[3px] [&>span]:text-xs [&>span]:opacity-70",
        className
      )}
      {...props}
    />
  );
}

export { Calendar, CalendarDayButton };

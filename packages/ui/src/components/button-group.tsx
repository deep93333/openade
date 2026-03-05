"use client";
import * as React from "react";

import { cn } from "../lib/utils";

type ButtonGroupProps = React.ComponentProps<"div">;

const ButtonGroup = React.forwardRef<HTMLDivElement, ButtonGroupProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      data-slot="button-group"
      className={cn(
        "flex items-center",
        "[&>[data-slot='button']:not(:first-child)]:-ml-px",
        "[&>[data-slot='button']:not(:first-child)]:rounded-l-none!",
        "[&>[data-slot='button']:not(:last-child)]:rounded-r-none!",
        "[&>*]:relative [&>*:hover]:z-10 [&>*:focus-within]:z-10",
        className
      )}
      {...props}
    />
  )
);
ButtonGroup.displayName = "ButtonGroup";

export { ButtonGroup };

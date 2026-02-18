import { cn } from "../lib/utils";
import type { IconProps } from "./types";

export function CalendarIcon({ className }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className={cn("size-4", className)}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M3.75 6.75C3.75 5.64543 4.64543 4.75 5.75 4.75H18.25C19.3546 4.75 20.25 5.64543 20.25 6.75V18.25C20.25 19.3546 19.3546 20.25 18.25 20.25H5.75C4.64543 20.25 3.75 19.3546 3.75 18.25V6.75Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path d="M7.75 4.75V2.75" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M16.25 4.75V2.75" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M7.75 8.75H16.25" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

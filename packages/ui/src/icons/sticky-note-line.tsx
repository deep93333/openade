import { cn } from "../lib/utils";
import type { IconProps } from "./types";

export function StickyNoteLineIcon({ className }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      className={cn("size-4", className)}
      aria-hidden="true"
    >
      <path
        d="M4 6C4 4.89543 4.89543 4 6 4H18C19.1046 4 20 4.89543 20 6V15.1716C20 15.702 19.7893 16.2107 19.4142 16.5858L16.5858 19.4142C16.2107 19.7893 15.702 20 15.1716 20H6C4.89543 20 4 19.1046 4 18V6Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M15 20V17C15 15.8954 15.8954 15 17 15H20"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M9 9H15"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M9 13H11"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

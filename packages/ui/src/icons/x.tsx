import { cn } from "../lib/utils";
import type { IconProps } from "./types";
export function XIcon({ className }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      className={cn("size-4", className)}
      aria-hidden="true"
    >
      <path
        d="M6.25 6.25L17.75 17.75M17.75 6.25L6.25 17.75"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
      />
    </svg>
  );
}

import { cn } from "../lib/utils";
import type { IconProps } from "./types";

export function ScanIcon({ className }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      className={cn("size-4", className)}
      aria-hidden="true"
    >
      <path
        d="M7.25 4.75H4.75C3.64543 4.75 2.75 5.64543 2.75 6.75V9.25M16.75 4.75H19.25C20.3546 4.75 21.25 5.64543 21.25 6.75V9.25M21.25 14.75V17.25C21.25 18.3546 20.3546 19.25 19.25 19.25H16.75M7.25 19.25H4.75C3.64543 19.25 2.75 18.3546 2.75 17.25V14.75"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

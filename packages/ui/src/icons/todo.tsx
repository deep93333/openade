import { cn } from "../lib/utils";
import type { IconProps } from "./types";

export function TodoIcon({ className }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className={cn("size-4", className)}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M15.75 20.25H18.25C19.3546 20.25 20.25 19.3546 20.25 18.25V5.75C20.25 4.64543 19.3546 3.75 18.25 3.75H5.75C4.64543 3.75 3.75 4.64543 3.75 5.75V18.25C3.75 19.3546 4.64543 20.25 5.75 20.25H8.25M9 13.0929L11.2327 15.0599L15.14 9.43994"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

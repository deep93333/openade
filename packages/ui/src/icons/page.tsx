import { cn } from "../lib/utils";
import type { IconProps } from "./types";

export const PageIcon = ({ className }: IconProps) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className={cn("size-4", className)}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M4.75 4.75C4.75 3.64543 5.64543 2.75 6.75 2.75H17.25C18.3546 2.75 19.25 3.64543 19.25 4.75V19.25C19.25 20.3546 18.3546 21.25 17.25 21.25H6.75C5.64543 21.25 4.75 20.3546 4.75 19.25V4.75Z"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M8.75 6.75H15.25"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M8.75 10.75H15.25"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M8.75 14.75H11.25"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

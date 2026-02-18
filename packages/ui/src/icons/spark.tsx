import { cn } from "../lib/utils";
import type { IconProps } from "./types";

export const SparkIcon = ({ className }: IconProps) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className={cn("size-4", className)}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M12 2.75C13 8 16 11 21.25 12C16 13 13 16 12 21.25C11 16 8 13 2.75 12C8 11 11 8 12 2.75Z"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="square"
        strokeLinejoin="round"
      />
    </svg>
  );
};

import { cn } from "../lib/utils";
import type { IconProps } from "./types";

export const ArchiveIcon = ({ className }: IconProps) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className={cn("size-4", className)}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M20.25 17.05V7.75H3.75V17.05C3.75 18.1701 3.75 18.7302 3.96799 19.158C4.15973 19.5343 4.46569 19.8403 4.84202 20.032C5.26984 20.25 5.8299 20.25 6.95 20.25H17.05C18.1701 20.25 18.7302 20.25 19.158 20.032C19.5343 19.8403 19.8403 19.5343 20.032 19.158C20.25 18.7302 20.25 18.1701 20.25 17.05Z"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M2.75 3.75H21.25V7.75H2.75V3.75Z"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M10 11.75H14"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

import { cn } from "../lib/utils";
import type { IconProps } from "./types";

export const LlmChatIcon = ({ className }: IconProps) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className={cn("size-4", className)}
      viewBox="0 0 200 200"
      fill="none"
      aria-hidden="true"
    >
      <rect x="87.4995" width="25" height="25" rx="12" fill="currentColor" />
      <rect y="87.4998" width="25" height="25" rx="12" fill="currentColor" />
      <rect x="175" y="87.4998" width="25" height="25" rx="12" fill="currentColor" />
      <rect x="87.4995" y="112.5" width="25" height="25" rx="12" fill="currentColor" />
      <rect x="137.5" y="62.5" width="25" height="25" rx="12" fill="currentColor" />
      <rect x="62.5" y="137.5" width="25" height="25" rx="12" fill="currentColor" />
      <rect x="87.4995" y="175" width="25" height="25" rx="12" fill="currentColor" />
      <rect x="62.5" y="37.5" width="25" height="25" rx="12" fill="currentColor" />
      <rect x="87.4995" y="62.5" width="25" height="25" rx="12" fill="currentColor" />
      <rect x="112.5" y="37.5" width="25" height="25" rx="12" fill="currentColor" />
      <rect x="112.5" y="87.4998" width="25" height="25" rx="12" fill="currentColor" />
      <rect x="37.4995" y="62.5" width="25" height="25" rx="12" fill="currentColor" />
      <rect x="37.4995" y="112.5" width="25" height="25" rx="12" fill="currentColor" />
      <rect x="137.5" y="112.5" width="25" height="25" rx="12" fill="currentColor" />
      <rect x="62.5" y="87.4998" width="25" height="25" rx="12" fill="currentColor" />
      <rect x="113.281" y="137.5" width="25" height="25" rx="12" fill="currentColor" />
    </svg>
  );
};

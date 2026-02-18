import { cn } from "../lib/utils";
import type { IconProps } from "./types";

export const BookIcon = ({ className }: IconProps) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className={cn("size-4", className)}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M11 5.25356L5.65079 4.06484C3.77725 3.6485 2 5.07416 2 6.99341V16.8958C2 18.3019 2.9766 19.5194 4.34921 19.8244L11 21.3023V5.25356Z"
        fill="currentColor"
      />
      <path
        d="M13 21.3023L19.6508 19.8244C21.0234 19.5194 22 18.3019 22 16.8958V6.99341C22 5.07416 20.2227 3.6485 18.3492 4.06484L13 5.25356V21.3023Z"
        fill="currentColor"
      />
    </svg>
  );
};

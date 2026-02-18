import type { IconProps } from "./types";

export const PlayIcon = ({ className, strokeWidth = 1.5, ...props }: IconProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    className={className}
    aria-hidden="true"
    {...props}
  >
    <path
      d="M20.155 10.3209L8.8365 2.99715C7.50578 2.13609 5.75 3.09128 5.75 4.67629V19.3237C5.75 20.9087 7.50577 21.8639 8.8365 21.0029L20.155 13.6791C21.373 12.891 21.373 11.109 20.155 10.3209Z"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinejoin="round"
    />
  </svg>
);

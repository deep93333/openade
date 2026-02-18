import type { IconProps } from "./types";

export const AudioIcon = ({ className, strokeWidth = 1.5, ...props }: IconProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    className={className}
    aria-hidden="true"
    {...props}
  >
    <path
      d="M7.75 3.75V20.25M3.75 9.75V14.25M12 7.75V16.25M16.25 5.75V18.25M20.25 9.75V14.25"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
    />
  </svg>
);

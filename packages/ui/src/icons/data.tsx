import type { IconProps } from "./types";

export const DataIcon = ({ className, ...props }: IconProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    className={className}
    aria-hidden="true"
    {...props}
  >
    <path
      d="M19.25 5.31944C19.25 6.73851 16.0041 7.88889 12 7.88889C7.99594 7.88889 4.75 6.73851 4.75 5.31944M19.25 5.31944C19.25 3.90038 16.0041 2.75 12 2.75C7.99594 2.75 4.75 3.90038 4.75 5.31944M19.25 5.31944V18.6806C19.25 20.0996 16.0041 21.25 12 21.25C7.99594 21.25 4.75 20.0996 4.75 18.6806V5.31944M19.25 12C19.25 13.3807 16.0041 14.5 12 14.5C7.99594 14.5 4.75 13.3807 4.75 12"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

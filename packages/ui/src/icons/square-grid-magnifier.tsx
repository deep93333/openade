import type { IconProps } from "./types";

export function SquareGridMagnifierIcon({ className, ...props }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      {...props}
      aria-hidden="true"
    >
      <path
        d="M6.75 3.75H17.25"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M4.75 7.25H19.25"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M19.1556 10.75H4.84441C3.53306 10.75 2.57653 11.9908 2.91026 13.259L4.35763 18.759C4.58885 19.6376 5.38324 20.25 6.29178 20.25H17.7082C18.6168 20.25 19.4112 19.6376 19.6424 18.759L21.0897 13.259C21.4235 11.9908 20.4669 10.75 19.1556 10.75Z"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

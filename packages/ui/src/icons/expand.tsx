import type { IconProps } from "./types";

export function ExpandIcon({ className, ...props }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden="true"
      {...props}
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M11 3H3V11H5V6.41421L10 11.4142L11.4142 10L6.41421 5H11V3ZM12.5858 14L17.5858 19H13V21H21V13H19V17.5858L14 12.5858L12.5858 14Z"
        fill="currentColor"
      />
    </svg>
  );
}

import type { IconProps } from "./types";

export const LeafIcon = ({ className, ...props }: IconProps) => {
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
        d="M4 3C3.44772 3 3 3.44772 3 4V5C3 9.41828 6.58172 13 11 13V20C11 20.5523 11.4477 21 12 21C12.5523 21 13 20.5523 13 20V16C17.4183 16 21 12.4183 21 8V7C21 6.44772 20.5523 6 20 6H19C16.4707 6 14.2156 7.17377 12.7496 9.0063C11.8637 5.55265 8.72995 3 5 3H4Z"
        fill="currentColor"
      />
    </svg>
  );
};


import type { IconProps } from "./types";

export function PanelResizeIcon({ className, ...props }: IconProps) {
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
        d="M12 6C12 5.44772 12.4477 5 13 5H18C18.5523 5 19 5.44772 19 6V11C19 11.5523 18.5523 12 18 12C17.4477 12 17 11.5523 17 11V7H13C12.4477 7 12 6.55228 12 6ZM6 12C6.55228 12 7 12.4477 7 13V17H11C11.5523 17 12 17.4477 12 18C12 18.5523 11.5523 19 11 19H6C5.44772 19 5 18.5523 5 18V13C5 12.4477 5.44772 12 6 12Z"
        fill="currentColor"
      />
    </svg>
  );
}

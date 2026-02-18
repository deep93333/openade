import { cn } from "../lib/utils";

export const ChevronUpDownIcon = ({ className }: { className?: string }) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className={cn("size-4", className)}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12.0002 3.58569L17.4144 8.99991L16.0002 10.4141L12.0002 6.41412L8.00015 10.4141L6.58594 8.99991L12.0002 3.58569ZM8.00015 13.5857L12.0002 17.5857L16.0002 13.5857L17.4144 14.9999L12.0002 20.4141L6.58594 14.9999L8.00015 13.5857Z"
        fill="currentColor"
      />
    </svg>
  );
};

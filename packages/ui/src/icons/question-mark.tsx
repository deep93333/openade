type QuestionMarkIconProps = {
  className?: string;
  size?: number;
};

export function QuestionMarkIcon({ className, size = 24 }: QuestionMarkIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      width={size}
      height={size}
      className={className}
    >
      <path d="M12 16V16.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path
        d="M12 13C12 11.3608 14 11.9319 14 10C14 8.89543 13.1046 8 12 8C11.2597 8 10.6134 8.4022 10.2676 9"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

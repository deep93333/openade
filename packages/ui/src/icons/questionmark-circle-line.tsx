type QuestionmarkCircleLineIconProps = {
  className?: string;
  size?: number;
};

export function QuestionmarkCircleLineIcon({
  className,
  size = 24,
}: QuestionmarkCircleLineIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      width={size}
      height={size}
      className={className}
    >
      <path
        d="M12 21C16.9706 21 21 16.9706 21 12C21 7.02944 16.9706 3 12 3C7.02944 3 3 7.02944 3 12C3 16.9706 7.02944 21 12 21Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
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

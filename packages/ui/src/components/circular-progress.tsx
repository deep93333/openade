import { cn } from "../lib/utils";

type CircularProgressProps = {
  value?: number;
  className?: string;
  size?: number;
  strokeWidth?: number;
};

export const CircularProgress = ({
  value = 60,
  className,
  size = 36,
  strokeWidth = 4,
}: CircularProgressProps) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;

  return (
    <div className={cn("relative size-4 shrink-0", className)}>
      <svg
        className="size-full -rotate-90"
        viewBox={`0 0 ${size} ${size}`}
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          className="text-white/20"
          strokeWidth={strokeWidth}
          stroke="currentColor"
          strokeLinecap="round"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          className="text-white"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          stroke="currentColor"
          strokeDashoffset={offset}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
};

import type { TaskStatus } from "@agentide/shared";
import { cn } from "@/lib/cn";

type TaskStatusIconProps = {
  status: TaskStatus;
  size?: number;
  className?: string;
};

const CX = 10;
const CY = 10;
const OUTER_R = 8;
const INNER_R = 4.5;
const STROKE_W = 2;

function BrainstormIcon({ size, className }: { size: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      className={cn("shrink-0", className)}
    >
      <circle
        cx={CX}
        cy={CY}
        r={OUTER_R}
        stroke="currentColor"
        strokeWidth={STROKE_W}
        strokeDasharray="3 1.5"
        fill="none"
        opacity={0.7}
      />
      <path
        d="M8 8.2a2.2 2.2 0 0 1 2.1-2.2c1.2-.05 2.3.85 2.3 2.1 0 .9-.55 1.4-1.15 1.75-.35.2-.65.45-.65.85v.3"
        stroke="currentColor"
        strokeWidth={1.4}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        opacity={0.85}
      />
      <circle cx={10.5} cy={13} r={0.75} fill="currentColor" opacity={0.85} />
    </svg>
  );
}

function BacklogIcon({ size, className }: { size: number; className?: string }) {
  const circumference = 2 * Math.PI * OUTER_R;
  const segments = 12;
  const dash = circumference / segments * 0.45;
  const gap = circumference / segments - dash;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      className={cn("shrink-0", className)}
    >
      <circle
        cx={CX}
        cy={CY}
        r={OUTER_R}
        stroke="currentColor"
        strokeWidth={STROKE_W}
        strokeDasharray={`${dash} ${gap}`}
        fill="none"
      />
    </svg>
  );
}

const PIE_ROUND = 1.2;

function pieSectorPath(cx: number, cy: number, r: number, fraction: number): string {
  const angle = fraction * 2 * Math.PI;
  const startX = cx + r * Math.sin(0);
  const startY = cy - r * Math.cos(0);
  const endX = cx + r * Math.sin(angle);
  const endY = cy - r * Math.cos(angle);
  const largeArc = fraction > 0.5 ? 1 : 0;
  return `M ${cx} ${cy} L ${startX} ${startY} A ${r} ${r} 0 ${largeArc} 1 ${endX} ${endY} Z`;
}

type PieProps = { fraction: number; opacity?: number; className?: string };

function PieSector({ fraction, opacity = 1, className }: PieProps) {
  return (
    <path
      d={pieSectorPath(CX, CY, INNER_R, fraction)}
      fill="currentColor"
      stroke="currentColor"
      strokeWidth={PIE_ROUND}
      strokeLinejoin="round"
      strokeLinecap="round"
      opacity={opacity}
      className={className}
      paintOrder="stroke"
    />
  );
}

function PlanningIcon({ size, className }: { size: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      className={cn("shrink-0", className)}
    >
      <circle
        cx={CX}
        cy={CY}
        r={OUTER_R}
        stroke="currentColor"
        strokeWidth={STROKE_W}
        opacity={0.25}
        fill="none"
      />
      <PieSector fraction={0.25} opacity={0.9} className="animate-pulse" />
      <circle
        cx={CX}
        cy={CY}
        r={OUTER_R}
        stroke="currentColor"
        strokeWidth={STROKE_W}
        opacity={0.4}
        fill="none"
      />
    </svg>
  );
}

function InProgressIcon({ size, className }: { size: number; className?: string }) {
  const circumference = 2 * Math.PI * OUTER_R;
  const filled = circumference * 0.5;
  const gap = circumference - filled;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      className={cn("shrink-0", className)}
    >
      <circle
        cx={CX}
        cy={CY}
        r={OUTER_R}
        stroke="currentColor"
        strokeWidth={STROKE_W}
        opacity={0.2}
        fill="none"
      />
      <circle
        cx={CX}
        cy={CY}
        r={INNER_R}
        fill="currentColor"
        opacity={0.15}
      />
      <circle
        cx={CX}
        cy={CY}
        r={OUTER_R}
        stroke="currentColor"
        strokeWidth={STROKE_W}
        strokeDasharray={`${filled} ${gap}`}
        strokeLinecap="round"
        fill="none"
        style={{
          transformOrigin: "10px 10px",
          animation: "task-spin 1.4s linear infinite",
        }}
      />
    </svg>
  );
}

function AgentReviewIcon({ size, className }: { size: number; className?: string }) {
  const circumference = 2 * Math.PI * OUTER_R;
  const filled = circumference * 0.65;
  const gap = circumference - filled;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      className={cn("shrink-0", className)}
    >
      <circle
        cx={CX}
        cy={CY}
        r={OUTER_R}
        stroke="currentColor"
        strokeWidth={STROKE_W}
        opacity={0.2}
        fill="none"
      />
      <circle
        cx={CX}
        cy={CY}
        r={OUTER_R}
        stroke="currentColor"
        strokeWidth={STROKE_W}
        strokeDasharray={`${filled} ${gap}`}
        strokeLinecap="round"
        fill="none"
        style={{
          transformOrigin: "10px 10px",
          animation: "task-spin 1.8s linear infinite",
        }}
      />
      {/* bot face */}
      <circle cx={8} cy={10} r={0.9} fill="currentColor" opacity={0.9} />
      <circle cx={12} cy={10} r={0.9} fill="currentColor" opacity={0.9} />
      <path
        d="M8 12.2 Q10 13.5 12 12.2"
        stroke="currentColor"
        strokeWidth={1.1}
        strokeLinecap="round"
        fill="none"
        opacity={0.9}
      />
    </svg>
  );
}

function InReviewIcon({ size, className }: { size: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      className={cn("shrink-0", className)}
    >
      <circle
        cx={CX}
        cy={CY}
        r={OUTER_R}
        stroke="currentColor"
        strokeWidth={STROKE_W}
        opacity={0.25}
        fill="none"
      />
      <PieSector fraction={0.75} />
      <circle
        cx={CX}
        cy={CY}
        r={OUTER_R}
        stroke="currentColor"
        strokeWidth={STROKE_W}
        opacity={0.4}
        fill="none"
      />
    </svg>
  );
}

function CompletedIcon({ size, className }: { size: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      className={cn("shrink-0", className)}
    >
      <circle cx={CX} cy={CY} r={OUTER_R + STROKE_W / 2} fill="currentColor" />
      <path
        d="M6 10 L9 13 L14 7"
        stroke="#064e3b"
        strokeWidth={STROKE_W}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const statusConfig: Record<
  TaskStatus,
  {
    Icon: typeof BacklogIcon;
    colorClass: string;
  }
> = {
  brainstorm: { Icon: BrainstormIcon, colorClass: "text-orange-400" },
  backlog: { Icon: BacklogIcon, colorClass: "text-zinc-400" },
  planning: { Icon: PlanningIcon, colorClass: "text-purple-400" },
  in_progress: { Icon: InProgressIcon, colorClass: "text-blue-400" },
  agent_review: { Icon: AgentReviewIcon, colorClass: "text-violet-400" },
  in_review: { Icon: InReviewIcon, colorClass: "text-yellow-400" },
  completed: { Icon: CompletedIcon, colorClass: "text-emerald-500" },
};

export function TaskStatusIcon({ status, size = 18, className }: TaskStatusIconProps) {
  const { Icon, colorClass } = statusConfig[status] ?? statusConfig.backlog;
  return <Icon size={size} className={cn(colorClass, className)} />;
}

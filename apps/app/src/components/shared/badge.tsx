import type { TaskStatus } from "@agentide/shared";
import { Badge } from "@agentide/ui";
import { cn } from "@/lib/cn";

type TaskStatusBadgeProps = {
  status: TaskStatus;
  size?: "sm" | "md" | "lg";
  className?: string;
};

const taskStatusConfig: Record<TaskStatus, {
  label: string;
  variant: "gray" | "blue" | "yellow" | "green" | "purple" | "orange";
  icon: string;
}> = {
  brainstorm: {
    label: "Brainstorm",
    variant: "orange",
    icon: "⚡",
  },
  backlog: {
    label: "Todo",
    variant: "gray",
    icon: "⏳",
  },
  planning: {
    label: "Planning",
    variant: "purple",
    icon: "📋",
  },
  in_progress: {
    label: "In Progress",
    variant: "blue",
    icon: "🔄",
  },
  agent_review: {
    label: "Agent Review",
    variant: "blue",
    icon: "🤖",
  },
  in_review: {
    label: "Human Review",
    variant: "yellow",
    icon: "👀",
  },
  completed: {
    label: "Ready",
    variant: "green",
    icon: "✅",
  },
};

export const TaskStatusBadge = ({ status, size = "sm", className }: TaskStatusBadgeProps) => {
  const config = taskStatusConfig[status];

  return (
    <Badge
      variant={config.variant}
      size={size}
      className={cn("font-medium", className)}
    >
      <span className="mr-1 text-xs">{config.icon}</span>
      {config.label}
    </Badge>
  );
};

export const getTaskStatusColor = (status: TaskStatus): string => {
  return taskStatusConfig[status].variant;
};

export const getTaskStatusLabel = (status: TaskStatus): string => {
  return taskStatusConfig[status].label;
};
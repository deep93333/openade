import type { TaskStatus } from "@agentide/shared";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@agentide/ui";
import { TaskStatusBadge, getTaskStatusLabel } from "./badge";

type TaskStatusSelectorProps = {
  value: TaskStatus;
  onChange: (status: TaskStatus) => void;
  variant?: "select" | "context-menu";
  className?: string;
  children?: React.ReactNode;
};

const taskStatuses: TaskStatus[] = ["brainstorm", "backlog", "in_progress", "agent_review", "in_review", "completed"];

export const TaskStatusSelector = ({
  value,
  onChange,
  variant = "select",
  className,
  children
}: TaskStatusSelectorProps) => {
  if (variant === "context-menu") {
    return (
      <ContextMenu>
        <ContextMenuTrigger asChild>
          {children}
        </ContextMenuTrigger>
        <ContextMenuContent>
          {taskStatuses.map((status) => (
            <ContextMenuItem
              key={status}
              onClick={() => onChange(status)}
              className="flex items-center gap-2"
            >
              <TaskStatusBadge status={status} size="sm" />
            </ContextMenuItem>
          ))}
        </ContextMenuContent>
      </ContextMenu>
    );
  }

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className={className}>
        <SelectValue>
          <TaskStatusBadge status={value} size="sm" />
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {taskStatuses.map((status) => (
          <SelectItem key={status} value={status}>
            <div className="flex items-center gap-2">
              <TaskStatusBadge status={status} size="sm" />
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};
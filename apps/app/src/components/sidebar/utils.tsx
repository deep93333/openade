import type { AgentStatus, TaskStatus } from "@openade/shared";
import type { ChatThread } from "@openade/shared";
import {
  IconAlertCircle,
  IconCircle,
  IconPlayerPause,
  IconPlayerPlay,
} from "@tabler/icons-react";
import { getTaskStatusLabel } from "@/components/shared/badge";
import { TaskStatusIcon } from "@/components/tasks/task-status-icon";
import { normalizeUserMessageContentToText } from "@/utils/normalize-user-message";

export const TASK_STATUSES: TaskStatus[] = [
  "brainstorm",
  "backlog",
  "in_progress",
  "in_review",
  "completed",
];

export function threadLabel(thread: ChatThread): string {
  if (thread.title?.trim()) {
    return normalizeUserMessageContentToText(thread.title).trim();
  }
  const first = thread.messages.find((m) => m.role === "user");
  if (first?.content) {
    const text = normalizeUserMessageContentToText(first.content).trim().replace(/\s+/g, " ");
    return text.length > 24 ? `${text.slice(0, 24)}…` : text;
  }
  return "New chat";
}

export function getThreadStatusIcon(status: AgentStatus) {
  switch (status) {
    case "running":
      return <IconPlayerPlay className="size-3.5 text-blue-500 shrink-0" stroke={2} />;
    case "error":
      return <IconAlertCircle className="size-3.5 text-red-500 shrink-0" stroke={2} />;
    case "stopped":
      return <IconPlayerPause className="size-3.5 text-yellow-500 shrink-0" stroke={2} />;
    case "idle":
    default:
      return <IconCircle className="size-3.5 text-muted-foreground shrink-0" stroke={2} />;
  }
}

export function getTaskStatusIcon(status: TaskStatus) {
  return <TaskStatusIcon status={status} />;
}

export { getTaskStatusLabel };

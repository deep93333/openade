import type { AgentStatus, TaskStatus } from "@agentide/shared";
import type { ChatThread } from "@agentide/shared";
import {
  IconAlertCircle,
  IconCircle,
  IconCircleCheckFilled,
  IconCircleDotted,
  IconCircleDot,
  IconPlayerPause,
  IconPlayerPlay,
  IconProgress,
} from "@tabler/icons-react";
import { getTaskStatusLabel } from "@/components/shared/task-status-badge";
import { normalizeUserMessageContentToText } from "@/utils/normalize-user-message";

export const TASK_STATUSES: TaskStatus[] = [
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
  switch (status) {
    case "in_progress":
      return <IconProgress className="size-4 text-accent shrink-0" stroke={2} />;
    case "in_review":
      return <IconCircleDot className="size-4 text-amber-700 shrink-0" stroke={2} />;
    case "completed":
      return <IconCircleCheckFilled className="size-4 text-indigo-500 shrink-0" stroke={2} />;
    case "backlog":
    default:
      return <IconCircleDotted className="size-4 text-muted-foreground shrink-0" stroke={2} />;
  }
}

export { getTaskStatusLabel };

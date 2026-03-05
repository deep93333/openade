import type { ChatThread, TaskStatus } from "@agentide/shared";
import type { ReactNode } from "react";
import { TaskStatusIcon } from "./task-status-icon";

export type WorkspaceTask = {
  workspaceId: string;
  workspaceName: string;
  workspacePath: string;
  thread: ChatThread;
};

export const taskStatuses: TaskStatus[] = ["brainstorm", "backlog", "planning", "in_progress", "agent_review", "in_review", "completed"];

export const taskStatusLabels: Record<TaskStatus, string> = {
  brainstorm: "Brainstorm",
  backlog: "Todo",
  planning: "Planning",
  in_progress: "In Progress",
  agent_review: "Agent Review",
  in_review: "Human Review",
  completed: "Ready",
};

export function getTaskStatusIcon(status: TaskStatus): ReactNode {
  return <TaskStatusIcon status={status} />;
}

export function getTaskTitle(thread: ChatThread): string {
  if (thread.title?.trim()) return thread.title.trim();
  const firstUserMessage = thread.messages.find((message) => message.role === "user");
  if (firstUserMessage?.content) {
    const text = firstUserMessage.content.trim().replace(/\s+/g, " ");
    if (text.length > 48) return `${text.slice(0, 48)}...`;
    return text;
  }
  return "Untitled task";
}

export function getRelativeTimeLabel(timestamp: number): string {
  const now = Date.now();
  const diffMs = now - timestamp;
  const isFuture = diffMs < 0;
  const absMs = Math.abs(diffMs);

  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  const week = 7 * day;
  const month = 30 * day;
  const year = 365 * day;

  const nowDate = new Date(now);
  const targetDate = new Date(timestamp);
  const nowStartOfDay = new Date(nowDate.getFullYear(), nowDate.getMonth(), nowDate.getDate()).getTime();
  const targetStartOfDay = new Date(
    targetDate.getFullYear(),
    targetDate.getMonth(),
    targetDate.getDate()
  ).getTime();
  const dayDiff = Math.round((nowStartOfDay - targetStartOfDay) / day);

  if (!isFuture && dayDiff === 0) {
    if (absMs < minute) return "just now";
    if (absMs < hour) return `${Math.max(1, Math.round(absMs / minute))}m ago`;
    if (absMs < 6 * hour) return `${Math.max(1, Math.round(absMs / hour))}h ago`;
    return "today";
  }

  if (!isFuture && dayDiff === 1) return "yesterday";

  if (absMs < minute) return "soon";
  if (absMs < hour) return isFuture ? `in ${Math.max(1, Math.round(absMs / minute))}m` : `${Math.max(1, Math.round(absMs / minute))}m ago`;
  if (absMs < day) return isFuture ? `in ${Math.max(1, Math.round(absMs / hour))}h` : `${Math.max(1, Math.round(absMs / hour))}h ago`;
  if (absMs < week) return isFuture ? `in ${Math.max(1, Math.round(absMs / day))}d` : `${Math.max(1, Math.round(absMs / day))}d ago`;
  if (absMs < month) return isFuture ? `in ${Math.max(1, Math.round(absMs / week))}w` : `${Math.max(1, Math.round(absMs / week))}w ago`;
  if (absMs < year)
    return isFuture ? `in ${Math.max(1, Math.round(absMs / month))}mo` : `${Math.max(1, Math.round(absMs / month))}mo ago`;
  return isFuture ? `in ${Math.max(1, Math.round(absMs / year))}y` : `${Math.max(1, Math.round(absMs / year))}y ago`;
}

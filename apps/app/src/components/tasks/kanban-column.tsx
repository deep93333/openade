import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { TaskStatus } from "@agentide/shared";
import { Badge } from "@agentide/ui";
import { IconPlus } from "@tabler/icons-react";
import { taskStatusLabels, getTaskStatusIcon } from "./task-utils";
import type { WorkspaceTask } from "./task-utils";
import { KanbanCard } from "./kanban-card";

const columnEmptyHints: Record<TaskStatus, string> = {
  brainstorm: "Capture rough ideas before they become tasks.",
  backlog: "Planned tasks waiting to be picked up.",
  planning: "Tasks being scoped and broken down.",
  in_progress: "Active tasks the agent is working on.",
  agent_review: "Drop tasks here for an automated agent review pass.",
  in_review: "Tasks awaiting your review before completion.",
  completed: "Finished tasks ready to ship.",
};

export type KanbanColumnProps = {
  status: TaskStatus;
  tasks: WorkspaceTask[];
  canDelete: (task: WorkspaceTask) => boolean;
  onOpenChat: (workspaceId: string, threadId: string) => Promise<void>;
  onStatusChange: (workspaceId: string, threadId: string, nextStatus: TaskStatus) => Promise<void>;
  onDeleteTask: (workspaceId: string, threadId: string) => Promise<void>;
  onStartAgent: (workspaceId: string, threadId: string) => Promise<void>;
  onNewTask?: () => void;
  onNewBrainstorm?: () => void;
};

export function KanbanColumn({
  status,
  tasks,
  canDelete,
  onOpenChat,
  onStatusChange,
  onDeleteTask,
  onStartAgent,
  onNewTask,
  onNewBrainstorm,
}: KanbanColumnProps) {
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const raw = e.dataTransfer.getData("application/json");
    if (!raw) return;
    try {
      const { workspaceId, threadId } = JSON.parse(raw) as { workspaceId: string; threadId: string };
      onStatusChange(workspaceId, threadId, status);
    } catch {
      // ignore malformed drag payloads
    }
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`flex min-w-[260px] pt-4 flex-1 flex-col transition-colors ${isDragOver ? "bg-accent/5" : ""}`}
    >
      <div className="flex items-center gap-2 px-4 pt-1.5 pb-2">
        {getTaskStatusIcon(status)}
        <span className="text-sm font-medium">{taskStatusLabels[status]}</span>
        <Badge variant="secondary" size="sm" className="font-medium">
          {tasks?.length ?? 0}
        </Badge>
      </div>
      <div className="flex min-h-[120px] px-2 flex-1 flex-col gap-3 overflow-y-auto p-2">

      {onNewBrainstorm && status === "brainstorm" && (
          <button
            type="button"
            onClick={onNewBrainstorm}
            className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-foreground/20 px-2 py-2 text-sm text-muted-foreground transition-colors hover:border-foreground/40 hover:bg-foreground/5"
          >
            <IconPlus className="size-4" stroke={2} />
            New brainstorm
          </button>
        )}
        {onNewTask && status === "backlog" && (
          <button
            type="button"
            onClick={onNewTask}
            className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-foreground/20 px-2 py-2 text-sm text-muted-foreground transition-colors hover:border-foreground/40 hover:bg-foreground/5"
          >
            <IconPlus className="size-4" stroke={2} />
            Add task
          </button>
        )}
      {tasks?.length === 0 && (
          <p className="px-1 py-2 text-center text-xs text-muted-foreground/50">
            {columnEmptyHints[status]}
          </p>
        )}
        <AnimatePresence initial={false}>
          {tasks?.map((task) => (
            <motion.div
              key={task.thread.id}
              initial={{ opacity: 0, y: -8, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              layout
            >
              <KanbanCard
                task={task}
                canDelete={canDelete(task)}
                onOpenChat={onOpenChat}
                onStatusChange={onStatusChange}
                onDeleteTask={onDeleteTask}
                onStartAgent={onStartAgent}
              />
            </motion.div>
          ))}
        </AnimatePresence>
     
      </div>
    </div>
  );
}

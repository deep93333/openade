import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { TaskStatus } from "@agentide/shared";
import {
  Badge,
  Button,
  ShimmeringText,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@agentide/ui";
import { IconDots, IconFile, IconProgress, IconRobot } from "@tabler/icons-react";
import { ArrowRightIcon } from "lucide-react";
import { useAgentActivity } from "@/hooks/use-agent-activity";
import { getTaskStatusLabel } from "../shared/badge";
import { taskStatuses, taskStatusLabels, getTaskStatusIcon, getTaskTitle, getRelativeTimeLabel } from "./task-utils";
import type { WorkspaceTask } from "./task-utils";
import { TaskPreviewPopover, TaskThreadDialog } from "./task-popover";
import { useTaskDialog } from "./task-dialog-provider";

export type TaskRowProps = {
  task: WorkspaceTask;
  canDelete: boolean;
  onOpenChat: (workspaceId: string, threadId: string) => Promise<void>;
  onStatusChange: (workspaceId: string, threadId: string, nextStatus: TaskStatus) => Promise<void>;
  onDeleteTask: (workspaceId: string, threadId: string) => Promise<void>;
  onStartAgent: (workspaceId: string, threadId: string) => Promise<void>;
};

export function TaskRow({ task, canDelete, onOpenChat, onStatusChange, onDeleteTask, onStartAgent }: TaskRowProps) {
  const { isRunning, activity } = useAgentActivity(task.workspaceId, task.thread.id);
  const { openPlanPreview, openReviewPreview } = useTaskDialog();
  const [previewOpen, setPreviewOpen] = useState(false);
  const [brainstormDialogOpen, setBrainstormDialogOpen] = useState(false);
  const isPlanningTask = task.thread.taskStatus === "planning";
  const isAgentReviewTask = task.thread.taskStatus === "agent_review";
  const isBrainstormTask = task.thread.taskStatus === "brainstorm";

  const rowContent = (
      <div
        className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1 hover:bg-foreground/5"
        onClick={isBrainstormTask ? () => setBrainstormDialogOpen(true) : undefined}
      >
        <div className="flex min-w-0 flex-1 items-center gap-3 rounded-lg px-2 py-1 text-left">
          <span className="w-20 shrink-0 text-xs text-muted-foreground">
            {getRelativeTimeLabel(task.thread.createdAt)}
          </span>
          <span className="truncate flex-1 text-sm font-medium">{getTaskTitle(task.thread)}</span>
        </div>

        <AnimatePresence>
          {isRunning && activity && (
            <motion.div
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: "auto" }}
              exit={{ opacity: 0, width: 0 }}
              transition={{ duration: 0.2 }}
            >
              <Badge variant="outline" size="sm" className="gap-1">
                <IconProgress className="size-3.5 animate-pulse" stroke={2} />
                <ShimmeringText text={activity} duration={1.8} spread={3} startOnView={false} />
              </Badge>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          {isPlanningTask && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                openPlanPreview(task, isRunning, () => void onStartAgent(task.workspaceId, task.thread.id))
              }
            >
              <IconFile className="size-3.5 text-purple-400" stroke={2} />
              View Plan
            </Button>
          )}

          {isAgentReviewTask && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => openReviewPreview(task, isRunning)}
            >
              <IconRobot className="size-3.5 text-violet-400" stroke={2} />
              View Review
            </Button>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm">
                {getTaskStatusIcon(task.thread.taskStatus ?? "backlog")}
                {getTaskStatusLabel(task.thread.taskStatus ?? "backlog")}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              {taskStatuses.map((taskStatus) => (
                <DropdownMenuItem
                  key={taskStatus}
                  onSelect={() => void onStatusChange(task.workspaceId, task.thread.id, taskStatus)}
                >
                  {getTaskStatusIcon(taskStatus)}
                  {taskStatusLabels[taskStatus]}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label="Task actions">
                <IconDots className="size-4" stroke={2} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                disabled={!canDelete}
                onSelect={() => void onDeleteTask(task.workspaceId, task.thread.id)}
              >
                Delete task
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Open thread"
            onClick={() => void onOpenChat(task.workspaceId, task.thread.id)}
          >
            <ArrowRightIcon className="size-3.5" />
          </Button>
        </div>
      </div>
  );

  return isBrainstormTask ? (
    <>
      <TaskThreadDialog
        thread={task.thread}
        workspaceId={task.workspaceId}
        workspacePath={task.workspacePath}
        open={brainstormDialogOpen}
        onOpenChange={setBrainstormDialogOpen}
        title={`Brainstorm: ${task.thread.title ?? "Untitled"}`}
      />
      {rowContent}
    </>
  ) : (
    <TaskPreviewPopover
      thread={task.thread}
      workspaceId={task.workspaceId}
      workspacePath={task.workspacePath}
      align="end"
      open={previewOpen}
      onOpenChange={setPreviewOpen}
    >
      {rowContent}
    </TaskPreviewPopover>
  );
}

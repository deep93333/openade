import { useCallback, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { TaskStatus } from "@agentide/shared";
import {
  Button,
  ShimmeringText,
  ArrowUpRightIcon,
  StopIcon,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  cn,
  ChatBubble,
  ChatBubbleLineIcon,
} from "@agentide/ui";
import { IconDots, IconFile, IconMessage, IconRobot } from "@tabler/icons-react";
import { useAgentStore } from "@/store/agent";
import { useAgentActivity } from "@/hooks/use-agent-activity";
import { useThreadChangedFiles } from "@/hooks/use-thread-changed-files";
import { taskStatuses, taskStatusLabels, getTaskStatusIcon, getTaskTitle, getRelativeTimeLabel } from "./task-utils";
import type { WorkspaceTask } from "./task-utils";
import { TaskPreviewPopover, TaskThreadDialog } from "./task-popover";
import { useTaskDialog } from "./task-dialog-provider";

export type KanbanCardProps = {
  task: WorkspaceTask;
  canDelete: boolean;
  onOpenChat: (workspaceId: string, threadId: string) => Promise<void>;
  onStatusChange: (workspaceId: string, threadId: string, nextStatus: TaskStatus) => Promise<void>;
  onDeleteTask: (workspaceId: string, threadId: string) => Promise<void>;
  onStartAgent: (workspaceId: string, threadId: string) => Promise<void>;
};

export function KanbanCard({ task, canDelete, onOpenChat, onStatusChange, onDeleteTask, onStartAgent }: KanbanCardProps) {
  const { isRunning, activity } = useAgentActivity(task.workspaceId, task.thread.id);
  const stopAgent = useAgentStore((s) => s.stopAgent);
  const threadChangedFiles = useThreadChangedFiles(task.thread.messages, task.workspacePath);
  const { openPlanPreview, openReviewPreview, openChangesDialog } = useTaskDialog();
  const [previewOpen, setPreviewOpen] = useState(false);
  const [brainstormDialogOpen, setBrainstormDialogOpen] = useState(false);
  const isPlanningTask = task.thread.taskStatus === "planning";
  const isAgentReviewTask = task.thread.taskStatus === "agent_review";
  const isBrainstormTask = task.thread.taskStatus === "brainstorm";
  const dragPayload = JSON.stringify({ workspaceId: task.workspaceId, threadId: task.thread.id });

  const handleViewPlan = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      openPlanPreview(task, isRunning, () => void onStartAgent(task.workspaceId, task.thread.id));
    },
    [openPlanPreview, task, isRunning, onStartAgent]
  );

  const handleViewReview = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      openReviewPreview(task, isRunning);
    },
    [openReviewPreview, task, isRunning]
  );

  const handleOpenChangesDialog = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      openChangesDialog(task);
    },
    [openChangesDialog, task]
  );

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData("application/json", dragPayload);
    e.dataTransfer.effectAllowed = "move";
    e.currentTarget.classList.add("opacity-50");
  };

  const handleDragEnd = (e: React.DragEvent) => {
    e.currentTarget.classList.remove("opacity-50");
  };

  const cardContent = (
      <div
        draggable
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onClick={isBrainstormTask ? () => setBrainstormDialogOpen(true) : undefined}
        className={cn(
          "group cursor-pointer shadow-[0_0px_60px_0px_rgba(255,255,255,.04)_inset,0_0.5px_1px_rgba(255,255,255,.2)_inset] rounded-xl bg-background px-2 py-2 transition-all active:cursor-grabbing opacity-90 hover:scale-100 hover:opacity-100",
          previewOpen && "ring-2 ring-accent-foreground/50 ring-offset-4 ring-offset-background opacity-100"
        )}
      >
        <div className="flex flex-col gap-1.5">
       
          <div className="flex flex-row items-center justify-between">
          <span className="text-xxs  text-muted-foreground/50 px-1">
            {getRelativeTimeLabel(task.thread.createdAt)}
          </span>

          <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon-xs" aria-label="Task actions">
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
              </div>

          <div className="flex items-center justify-between px-1 gap-1">
            <span className="text-left text-sm font-medium leading-snug line-clamp-2 flex-1">
              {getTaskTitle(task.thread)}
            </span>
            
          </div>
          <div className="flex flex-row items-center gap-1">
        
          <span className="text-xxs text-muted-foreground/50 px-1">
            {task.thread.model}
          </span>
        </div>

          <div className="flex items-center justify-between p-1 gap-1">
            <AnimatePresence>
              {isRunning && activity && (
                <motion.div
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: "auto" }}
                  exit={{ opacity: 0, width: 0 }}
                  transition={{ duration: 0.2 }}
                  className="w-full overflow-hidden flex items-center gap-1 text-xs font-medium text-muted-foreground truncate text-ellipsis"
                >
                  <ShimmeringText text={activity} duration={1.8} spread={3} startOnView={false} className="text-xs" />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {isPlanningTask && (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="justify-start w-full"
              onClick={handleViewPlan}
            >
              <IconFile className="size-3.5 text-purple-400" stroke={2} />
              View Plan
            </Button>
          )}

          {isAgentReviewTask && (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="justify-start w-full"
              onClick={handleViewReview}
            >
              <IconRobot className="size-3.5 text-violet-400" stroke={2} />
              View Review
            </Button>
          )}

          <div className="flex items-center justify-between gap-1 pt-1" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-1">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon-xs">
                    {getTaskStatusIcon(task.thread.taskStatus ?? "backlog")}
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

              {threadChangedFiles.length > 0 && (
                <Button
                  type="button"
                  size="xs"
                  variant="ghost"
                  className="px-1.5"
                  onClick={handleOpenChangesDialog}
                >
                  {threadChangedFiles.length} Files
                </Button>
              )}
            </div>

            <div className="flex gap-1">
           
              {isRunning && (
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label="Stop agent"
                  onClick={(e) => {
                    e.stopPropagation();
                    void stopAgent(task.workspaceId);
                  }}
                >
                  <StopIcon className="size-3.5" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label="Open thread"
                onClick={(e) => {
                  e.stopPropagation();
                  void onOpenChat(task.workspaceId, task.thread.id);
                }}
              >
                <ArrowUpRightIcon className="size-3.5" />
              </Button>
            
            </div>
          </div>
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
      {cardContent}
    </>
  ) : (
    <TaskPreviewPopover
      thread={task.thread}
      workspaceId={task.workspaceId}
      workspacePath={task.workspacePath}
      open={previewOpen}
      onOpenChange={setPreviewOpen}
    >
      {cardContent}
    </TaskPreviewPopover>
  );
}

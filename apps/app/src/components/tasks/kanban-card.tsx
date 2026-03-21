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
    Popover,
    PopoverContent,
    PopoverTrigger,
    cn,
  } from "@agentide/ui";
  import { IconAlertCircle, IconArchive, IconDots, IconFile, IconRobot } from "@tabler/icons-react";
  import { useAgentStore } from "@/store/agent";
  import { useChatEditorStore } from "@/store/editor";
  import { useAgentActivity } from "@/hooks/use-agent-activity";
  import { useThreadChangedFiles } from "@/hooks/use-thread-changed-files";
  import { taskStatuses, taskStatusLabels, getTaskStatusIcon, getTaskTitle, getTaskRawContent, getRelativeTimeLabel } from "./task-utils";
  import type { WorkspaceTask } from "./task-utils";
  import { UserMessagePreview } from "@/components/agent/mention-chip";
  import { TaskPreviewPopover, TaskThreadDialog } from "./task-popover";
  import { TaskErrorActions, TaskErrorNotice } from "./task-error";
  import { useTaskDialog } from "./task-dialog-provider";

  const MODEL_CONTEXT_WINDOW: Record<string, number> = {
    "claude-sonnet-4-6": 200_000,
    "claude-opus-4-6": 200_000,
    "claude-haiku-4-5": 200_000,
    "claude-sonnet-4-20250514": 200_000,
    "gpt-5.2": 128_000,
    "gpt-5-mini": 128_000,
    "gpt-5.2-codex": 400_000,
    "gpt-5.3-codex": 400_000,
    "gpt-5.1-codex-mini": 400_000,
    "kimi-k2": 128_000,
    "kimi-k2.5": 128_000,
    "kimi-k2-thinking": 128_000,
};

const DEFAULT_CONTEXT_WINDOW = 200_000;

  function formatTokensShort(n: number): string {
    if (n == null || isNaN(n)) return "0";
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k`;
    return n.toString();
  }

  function ContextProgressRingSvg({ used, total, size = 5, strokeWidth = 0.5 }: { used: number; total: number; size?: number; strokeWidth?: number }) {
    const pct = total > 0 ? Math.min(1, used / total) : 0;
    const radius = Math.max(0.5, (size - strokeWidth) / 2);
    const circumference = 2 * Math.PI * radius;
    const offset = circumference * (1 - pct);

    const color = "text-foreground";

    return (
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className={cn("shrink-0 size-3", color)}
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          opacity={0.2}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          className="transition-[stroke-dashoffset] duration-500"
        />
      </svg>
    );
  }

  export type KanbanCardProps = {
    task: WorkspaceTask;
    canDelete: boolean;
    onOpenChat: (workspaceId: string, threadId: string) => Promise<void>;
    onStatusChange: (workspaceId: string, threadId: string, nextStatus: TaskStatus) => Promise<void>;
    onDeleteTask: (workspaceId: string, threadId: string) => Promise<void>;
    onStartAgent: (workspaceId: string, threadId: string) => Promise<void>;
  };

  function formatDuration(start: number, end: number): string {
    const totalSeconds = Math.max(0, Math.round((end - start) / 1000));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) return `${hours}h ${minutes}m`;
    if (minutes > 0) return `${minutes}m ${seconds}s`;
    return `${seconds}s`;
  }

  function formatTokens(value: number): string {
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
    if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
    return value.toString();
  }

  function formatUsd(value: number): string {
    if (value <= 0) return "$0.00";
    if (value < 0.01) return `${value.toFixed(4)}`;
    return `${value.toFixed(2)}`;
  }

  type TaskStatsPopoverProps = {
    task: WorkspaceTask;
    contextUsed: number;
    contextWindow: number;
    open: boolean;
    onOpenChange: (open: boolean) => void;
  };

  function TaskStatsPopover({ task, contextUsed, contextWindow, open, onOpenChange }: TaskStatsPopoverProps) {
    const thread = useAgentStore((s) => s.workspaces[task.workspaceId]?.threads.find((t) => t.id === task.thread.id) ?? task.thread);
    const messages = thread.messages;
    const userMessages = messages.filter((m) => m.role === "user").length;
    const assistantMessages = messages.filter((m) => m.role === "assistant").length;
    const toolMessages = messages.filter((m) => m.role === "tool").length;
    const totalMessages = messages.length;
    const inputTokens = thread.inputTokens ?? messages.reduce((sum, m) => sum + (m.inputTokens ?? 0), 0);
    const outputTokens = thread.outputTokens ?? messages.reduce((sum, m) => sum + (m.outputTokens ?? 0), 0);
    const totalTokens = inputTokens + outputTokens;
    const totalCostUsd = messages.reduce((sum, m) => sum + (m.costUsd ?? 0), 0);
    const model = thread.model ?? "—";
    const durationMinutes = Math.max(0, ((thread.updatedAt ?? thread.createdAt) - thread.createdAt) / 60_000);

    const userPct = totalMessages > 0 ? (userMessages / totalMessages) * 100 : 0;
    const assistantPct = totalMessages > 0 ? (assistantMessages / totalMessages) * 100 : 0;
    const toolPct = totalMessages > 0 ? (toolMessages / totalMessages) * 100 : 0;

    const contextPct = contextWindow > 0 ? Math.min(1, contextUsed / contextWindow) : 0;
    const contextRemaining = Math.max(0, contextWindow - contextUsed);

    return (
      <Popover open={open} onOpenChange={onOpenChange}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            className="opacity-0 group-hover:opacity-100 transition-opacity"
            aria-label="Thread stats"
            onClick={(e) => {
              e.stopPropagation();
              onOpenChange(true);
            }}
          >
            <ContextProgressRingSvg used={contextUsed} total={contextWindow} />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          side="right"
          sideOffset={12}
          align="start"
          className="w-72 p-3 flex flex-col gap-4"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="text-xs text-muted-foreground">Cost, usage, and context breakdown.</div>

          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Context</span>
              <span className="font-medium">{Math.round(contextPct * 100)}%</span>
            </div>
            <div className="h-1 w-full overflow-hidden rounded-[1px] bg-foreground/10">
              <div
                className={cn(
                  "h-full rounded-[1px] transition-all duration-500 bg-foreground/50",
                )}
                style={{ width: `${contextPct * 100}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-xxs text-muted-foreground">
              <span>{formatTokensShort(contextUsed)} used</span>
              <span>{formatTokensShort(contextRemaining)} remaining</span>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Time</span>
              <span className="font-medium">{formatDuration(thread.createdAt, thread.updatedAt ?? thread.createdAt)} <span className="text-muted-foreground/60">({Math.round(durationMinutes)} min)</span></span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Tokens</span>
              <span className="font-medium">
                {formatTokens(totalTokens)}
                <span className="text-muted-foreground/60 ml-1">{formatTokens(inputTokens)}↑ {formatTokens(outputTokens)}↓</span>
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Cost</span>
              <span className="font-medium">${formatUsd(totalCostUsd)} <span className="text-muted-foreground/60 ml-1 truncate">{model}</span></span>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Messages</span>
              <span className="font-medium">{totalMessages}</span>
            </div>
            <div className="flex h-6 w-full overflow-hidden rounded-sm bg-secondary/60">
              {userPct > 0 && (
                <div className="h-full bg-sky-400/70" style={{ width: `${userPct}%` }} />
              )}
              {assistantPct > 0 && (
                <div className="h-full bg-violet-400/70" style={{ width: `${assistantPct}%` }} />
              )}
              {toolPct > 0 && (
                <div className="h-full bg-yellow-400/70" style={{ width: `${toolPct}%` }} />
              )}
            </div>
            <div className="flex flex-row items-start gap-3 text-xxs text-muted-foreground">
              <span className="flex items-center gap-1">
                <span className="inline-block size-2 rounded-[1px] bg-sky-400/70" />
  <span className="font-medium">{userMessages}</span> User
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block size-2 rounded-[1px] bg-violet-400/70" />
                {assistantMessages} Assistant
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block size-2 rounded-[1px] bg-amber-400/70" />
                {toolMessages} Tool
              </span>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    );
  }

  export function KanbanCard({ task, canDelete, onOpenChat, onStatusChange, onDeleteTask, onStartAgent }: KanbanCardProps) {
    const { isRunning, activity } = useAgentActivity(task.workspaceId, task.thread.id);
    const stopAgent = useAgentStore((s) => s.stopAgent);
    const markThreadRead = useAgentStore((s) => s.markThreadRead);
    const modelOptions = useChatEditorStore((s) => s.modelOptions);
    const modelLabel = modelOptions.find((m) => m.value === task.thread.model)?.label ?? task.thread.model;
    const threadChangedFiles = useThreadChangedFiles(task.thread.messages, task.workspacePath);
    const liveThread = useAgentStore((s) => s.workspaces[task.workspaceId]?.threads.find((t) => t.id === task.thread.id) ?? task.thread);
    const runtime = useAgentStore((s) => s.getThreadRuntime(task.workspaceId, task.thread.id));
    const taskError = runtime.error;
    const contextUsed = (liveThread.lastRunInputTokens ?? liveThread.inputTokens ?? 0);
    const contextWindow = MODEL_CONTEXT_WINDOW[liveThread.model ?? ""] ?? DEFAULT_CONTEXT_WINDOW;
    const { openPlanPreview, openReviewPreview, openChangesDialog } = useTaskDialog();
    const [previewOpen, setPreviewOpen] = useState(false);
    const [brainstormDialogOpen, setBrainstormDialogOpen] = useState(false);
    const [statsOpen, setStatsOpen] = useState(false);
    const isPlanningTask = task.thread.taskStatus === "planning";
    const isAgentReviewTask = task.thread.taskStatus === "agent_review";
    const isBrainstormTask = task.thread.taskStatus === "brainstorm";
    const hasUnread = !isRunning && (task.thread.updatedAt ?? task.thread.createdAt) > (task.thread.lastReadAt ?? task.thread.createdAt);
    const dragPayload = JSON.stringify({ workspaceId: task.workspaceId, threadId: task.thread.id });

    const handleMarkRead = useCallback(() => {
      if (hasUnread) {
        markThreadRead(task.workspaceId, task.thread.id);
      }
    }, [hasUnread, markThreadRead, task.workspaceId, task.thread.id]);

    const handlePreviewOpenChange = useCallback(
      (open: boolean) => {
        setPreviewOpen(open);
        if (open) handleMarkRead();
      },
      [handleMarkRead]
    );

    const handleBrainstormDialogOpenChange = useCallback(
      (open: boolean) => {
        setBrainstormDialogOpen(open);
        if (open) handleMarkRead();
      },
      [handleMarkRead]
    );

    const handleViewPlan = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        handleMarkRead();
        openPlanPreview(task, isRunning, () => void onStartAgent(task.workspaceId, task.thread.id));
      },
      [openPlanPreview, task, isRunning, onStartAgent, handleMarkRead]
    );

    const handleViewReview = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        handleMarkRead();
        openReviewPreview(task, isRunning);
      },
      [openReviewPreview, task, isRunning, handleMarkRead]
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
          onClick={isBrainstormTask ? () => handleBrainstormDialogOpenChange(true) : undefined}
          className={cn(
            "group super-ellipse cursor-pointer shadow-[0_0px_60px_0px_rgba(255,255,255,.04)_inset,0_0.5px_1px_rgba(255,255,255,.2)_inset] rounded-xl bg-background px-2 py-2 transition-all active:cursor-grabbing opacity-90 hover:scale-100 hover:opacity-100",
            previewOpen && "ring-2 ring-accent-foreground/50 ring-offset-4 ring-offset-background opacity-100"
          )}
        >
          <div className="flex flex-col gap-1.5">
        
            <div className="flex flex-row items-center justify-between">
            <div className="flex items-center gap-1.5 px-1">
              {hasUnread && (
                <span className="relative flex size-1.5">
                  <span className="absolute size-3 inline-flex left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 animate-ping rounded-full bg-foreground opacity-25" />
                  <span className="relative inline-flex size-1.5 rounded-full bg-foreground" />
                </span>
              )}
              {taskError ? <IconAlertCircle className="size-3 text-rose-400" stroke={2} /> : null}
              <span className="text-xxs text-muted-foreground/50">
                {getRelativeTimeLabel(task.thread.updatedAt ?? task.thread.createdAt)}
              </span>
            </div>

            <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>

                  <Button
                    variant="ghost"
                    size="icon-xs"
                    aria-label="Archive task"
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => void onStatusChange(task.workspaceId, task.thread.id, "archived")}
                  >
                    <IconArchive className="size-3.5 text-muted-foreground" stroke={2} />
                  </Button>
                  <TaskStatsPopover task={task} contextUsed={contextUsed} contextWindow={contextWindow} open={statsOpen} onOpenChange={setStatsOpen} />

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
                </div>

            <div className="flex items-center justify-between px-1 gap-1">
              <span className="text-left text-sm font-medium leading-snug line-clamp-4 flex-1">
                {getTaskRawContent(task.thread)
                  ? <UserMessagePreview content={getTaskRawContent(task.thread)!} />
                  : getTaskTitle(task.thread)}
              </span>
            </div>
            <div className="flex flex-row items-center gap-1.5 px-1">
              <span className="text-xxs text-muted-foreground/50">
                {modelLabel}
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

           

            <div className="flex items-center justify-between gap-1 pt-1" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center gap-1">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon-xs" className="shrink-0">
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

{isPlanningTask && (
              <Button
                type="button"
                size="xs"
                variant="ghost"
                className="justify-start w-full px-1.5"
                onClick={handleViewPlan}
              >
                View Plan
              </Button>
            )}

            {isAgentReviewTask && (
              <Button
                type="button"
                size="xs"
                variant="ghost"
                className="justify-start w-full px-1.5"
                onClick={handleViewReview}
              >
                View Review
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
                    handleMarkRead();
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
          onOpenChange={handleBrainstormDialogOpenChange}
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
        onOpenChange={handlePreviewOpenChange}
      >
        {cardContent}
      </TaskPreviewPopover>
    );
  }

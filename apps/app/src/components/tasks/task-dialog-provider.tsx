import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ChatThread } from "@agentide/shared";
import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Textarea,
} from "@agentide/ui";
import { IconFile, IconPencil, IconPlayerPlay, IconProgress, IconRobot } from "@tabler/icons-react";
import { useAgentStore } from "@/store/agent";
import { useWorkspaceStore } from "@/store/workspace";
import { useThreadChangedFiles } from "@/hooks/use-thread-changed-files";
import { DiffStackViewer } from "@/components/diff";
import { DiffStats, FileName } from "@/components/primitives";
import type { WorkspaceTask } from "./task-utils";
import { MarkdownMessage } from "../agent/markdown";

type PlanDialogState = {
  task: { workspaceId: string; workspaceName: string; thread: ChatThread };
  isGenerating: boolean;
  onStartAgent: () => void;
};

type ReviewDialogState = {
  task: { workspaceId: string; workspaceName: string; thread: ChatThread };
  isGenerating: boolean;
};

type TaskDialogContextValue = {
  openPlanPreview: (task: WorkspaceTask, isGenerating: boolean, onStartAgent: () => void) => void;
  openReviewPreview: (task: WorkspaceTask, isGenerating: boolean) => void;
  openChangesDialog: (task: WorkspaceTask) => void;
};

const TaskDialogContext = createContext<TaskDialogContextValue | null>(null);

export function useTaskDialog() {
  const ctx = useContext(TaskDialogContext);
  if (!ctx) throw new Error("useTaskDialog must be used within TaskDialogProvider");
  return ctx;
}

type PlanPreviewDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  state: PlanDialogState;
};

function PlanPreviewDialog({ open, onOpenChange, state }: PlanPreviewDialogProps) {
  const planMessage = [...state.task.thread.messages].reverse().find(
    (m) => m.role === "assistant" && m.planContent
  );
  const hasPlan = !!planMessage?.planContent;
  const updateMessageContent = useAgentStore((s) => s.updateMessageContent);

  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState("");

  useEffect(() => {
    if (!open) setIsEditing(false);
  }, [open]);

  const handleStartEdit = () => {
    setEditValue(planMessage?.planContent ?? "");
    setIsEditing(true);
  };

  const handleSave = async () => {
    if (!planMessage) return;
    await updateMessageContent(
      state.task.workspaceId,
      state.task.thread.id,
      planMessage.id,
      { planContent: editValue, content: editValue }
    );
    setIsEditing(false);
  };

  const handleCancel = () => {
    setIsEditing(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl h-[70vh] flex flex-col p-0 overflow-hidden" showCloseButton>
        <DialogHeader className="border-b border-border px-4 py-3 shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <IconFile className="size-4 text-purple-400 shrink-0" stroke={2} />
            Implementation Plan
          </DialogTitle>
          <DialogDescription>{state.task.workspaceName}</DialogDescription>
        </DialogHeader>
        <DialogBody className="flex-1 min-h-0 overflow-y-auto px-4 py-3">
          {state.isGenerating && !hasPlan ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
              Generating plan…
            </div>
          ) : isEditing ? (
            <Textarea
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              className="w-full h-full min-h-[200px] resize-none font-mono text-sm"
              autoFocus
            />
          ) : hasPlan ? (
            <MarkdownMessage content={planMessage!.planContent ?? ""} />
          ) : (
            <p className="text-sm text-muted-foreground py-4">
              No plan generated yet. The plan will appear here once the planning agent finishes.
            </p>
          )}
        </DialogBody>
        <DialogFooter className="border-t border-border px-4 py-3 shrink-0">
          {isEditing ? (
            <>
              <Button variant="secondary" size="sm" onClick={handleCancel}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleSave}>
                Save
              </Button>
            </>
          ) : (
            <>
              <Button variant="secondary" size="sm" onClick={() => onOpenChange(false)}>
                Close
              </Button>
              {hasPlan && !state.isGenerating && (
                <Button variant="secondary" size="sm" onClick={handleStartEdit}>
                  <IconPencil className="size-3.5 mr-1.5" />
                  Edit
                </Button>
              )}
              <Button
                size="sm"
                disabled={!hasPlan || state.isGenerating}
                onClick={() => {
                  onOpenChange(false);
                  state.onStartAgent();
                }}
              >
                Start Agent
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type ReviewPreviewDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  state: ReviewDialogState;
};

function ReviewPreviewDialog({ open, onOpenChange, state }: ReviewPreviewDialogProps) {
  const reviewMessage = [...state.task.thread.messages].reverse().find(
    (m) => m.role === "assistant" && m.reviewContent
  );
  const hasReview = !!reviewMessage?.reviewContent;
  const updateMessageContent = useAgentStore((s) => s.updateMessageContent);

  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState("");

  useEffect(() => {
    if (!open) setIsEditing(false);
  }, [open]);

  const handleStartEdit = () => {
    setEditValue(reviewMessage?.reviewContent ?? "");
    setIsEditing(true);
  };

  const handleSave = async () => {
    if (!reviewMessage) return;
    await updateMessageContent(
      state.task.workspaceId,
      state.task.thread.id,
      reviewMessage.id,
      { reviewContent: editValue, content: editValue }
    );
    setIsEditing(false);
  };

  const handleCancel = () => {
    setIsEditing(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl h-[80vh] flex flex-col p-0 overflow-hidden" showCloseButton>
        <DialogHeader className="px-4 py-3 shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <IconRobot className="size-4 text-violet-400 shrink-0" stroke={2} />
            Agent Review Report
          </DialogTitle>
          <DialogDescription>{state.task.workspaceName}</DialogDescription>
        </DialogHeader>
        <DialogBody className="flex-1 min-h-0 overflow-y-auto flex flex-col items-center justify-center px-4 py-3">
          {state.isGenerating && !hasReview ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
              <IconProgress className="size-4 animate-pulse shrink-0" stroke={2} />
              Generating review…
            </div>
          ) : isEditing ? (
            <Textarea
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              className="w-full h-full min-h-[200px] resize-none font-mono text-sm self-stretch"
              autoFocus
            />
          ) : hasReview ? (
            <MarkdownMessage content={reviewMessage!.reviewContent ?? ""} />
          ) : (
            <p className="text-sm text-muted-foreground py-4">
              No review generated yet. The report will appear here once the agent finishes reviewing.
            </p>
          )}
        </DialogBody>
        <DialogFooter className="border-t border-border px-4 py-3 shrink-0">
          {isEditing ? (
            <>
              <Button variant="secondary" size="sm" onClick={handleCancel}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleSave}>
                Save
              </Button>
            </>
          ) : (
            <>
              <Button variant="secondary" size="sm" onClick={() => onOpenChange(false)}>
                Close
              </Button>
              {hasReview && !state.isGenerating && (
                <Button variant="secondary" size="sm" onClick={handleStartEdit}>
                  <IconPencil className="size-3.5 mr-1.5" />
                  Edit
                </Button>
              )}
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type ChangesDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  state: WorkspaceTask;
};

function ChangesDialog({ open, onOpenChange, state }: ChangesDialogProps) {
  const changedFiles = useThreadChangedFiles(state.thread.messages, state.workspacePath);
  const scrollToPathRef = useRef<((path: string) => void) | null>(null);

  const summary = useMemo(() => {
    let added = 0;
    let deleted = 0;
    for (const f of changedFiles) {
      added += f.added;
      deleted += f.deleted;
    }
    return { added, deleted };
  }, [changedFiles]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl h-[85vh] p-0 overflow-hidden bg-base-background" showCloseButton>
        <div className="flex min-h-0 flex-1">
          <DialogBody className="flex min-h-0 min-w-0 px-6 flex-1">
            {changedFiles.length === 0 ? (
              <div className="flex items-center justify-center w-full py-12 text-sm text-muted-foreground">
                No changed files.
              </div>
            ) : (
              <DiffStackViewer
                open={open}
                items={changedFiles}
                hideSidebar
                scrollToPathRef={scrollToPathRef}
                className="flex min-h-0 flex-1 p-6 flex-col"
              />
            )}
          </DialogBody>

          <div className="w-64 shrink-0 bg-background flex flex-col min-h-0">
            <div className="px-4 py-3 border-b border-border shrink-0">
              <DialogHeader className="p-0 flex flex-col gap-1">
                <DialogTitle className="flex items-center gap-2 text-sm">
                  Changed files
                  {changedFiles.length > 0 && (
                    <DiffStats added={summary.added} deleted={summary.deleted} badge className="shrink-0" />
                  )}
                </DialogTitle>
                <DialogDescription className="text-xs">
                  {state.workspaceName} · {changedFiles.length} file
                  {changedFiles.length === 1 ? "" : "s"}
                </DialogDescription>
              </DialogHeader>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto p-2">
              {changedFiles.map((file) => (
                <Button
                  key={file.path}
                  type="button"
                  onClick={() => scrollToPathRef.current?.(file.path)}
                  variant="ghost"
                  className="w-full justify-start gap-2"
                >
                  <FileName path={file.path} className="min-w-0 flex-1" nameClassName="text-xs text-foreground/80" />
                  <DiffStats added={file.added} deleted={file.deleted} badge className="shrink-0" />
                </Button>
              ))}
            </div>
            <div className="px-3 py-2 border-t border-border shrink-0 text-xs text-muted-foreground text-center">
              {state.workspacePath}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

const EMPTY_TASK: WorkspaceTask = {
  workspaceId: "",
  workspaceName: "",
  workspacePath: "",
  thread: { id: "", messages: [], createdAt: 0, updatedAt: 0 } as unknown as WorkspaceTask["thread"],
};

const EMPTY_PLAN_STATE: PlanDialogState = {
  task: { workspaceId: "", workspaceName: "", thread: EMPTY_TASK.thread },
  isGenerating: false,
  onStartAgent: () => {},
};

const EMPTY_REVIEW_STATE: ReviewDialogState = {
  task: { workspaceId: "", workspaceName: "", thread: EMPTY_TASK.thread },
  isGenerating: false,
};

export function TaskDialogProvider({ children }: { children: React.ReactNode }) {
  const selectWorkspace = useWorkspaceStore((state) => state.selectWorkspace);

  const [planOpen, setPlanOpen] = useState(false);
  const [planState, setPlanState] = useState<PlanDialogState>(EMPTY_PLAN_STATE);

  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewState, setReviewState] = useState<ReviewDialogState>(EMPTY_REVIEW_STATE);

  const [changesOpen, setChangesOpen] = useState(false);
  const [changesTask, setChangesTask] = useState<WorkspaceTask>(EMPTY_TASK);

  const openPlanPreview = useCallback(
    (task: WorkspaceTask, isGenerating: boolean, onStartAgent: () => void) => {
      setPlanState({ task: { workspaceId: task.workspaceId, workspaceName: task.workspaceName, thread: task.thread }, isGenerating, onStartAgent });
      setPlanOpen(true);
    },
    []
  );

  const openReviewPreview = useCallback(
    (task: WorkspaceTask, isGenerating: boolean) => {
      setReviewState({ task: { workspaceId: task.workspaceId, workspaceName: task.workspaceName, thread: task.thread }, isGenerating });
      setReviewOpen(true);
    },
    []
  );

  const openChangesDialog = useCallback(
    (task: WorkspaceTask) => {
      setChangesTask(task);
      setChangesOpen(true);
      void selectWorkspace(task.workspaceId);
    },
    [selectWorkspace]
  );

  return (
    <TaskDialogContext.Provider value={{ openPlanPreview, openReviewPreview, openChangesDialog }}>
      {children}
      {planOpen && (
        <PlanPreviewDialog open={planOpen} onOpenChange={setPlanOpen} state={planState} />
      )}
      {reviewOpen && (
        <ReviewPreviewDialog open={reviewOpen} onOpenChange={setReviewOpen} state={reviewState} />
      )}
      {changesOpen && (
        <ChangesDialog open={changesOpen} onOpenChange={setChangesOpen} state={changesTask} />
      )}
    </TaskDialogContext.Provider>
  );
}

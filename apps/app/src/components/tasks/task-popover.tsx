import { useEffect } from "react";
import type { ChatThread } from "@agentide/shared";
import {
  Button,
  ChevronDownIcon,
  StopIcon,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@agentide/ui";
import { TaskErrorActions, TaskErrorNotice } from "./task-error";
import { PopoverChatEditor } from "@/components/agent/chat-editor";
import { MessageListPreview } from "@/components/agent/messages";
import { useAgentStore } from "@/store/agent";
import { useChatEditorStore } from "@/store/editor";

function ModelDropdown({
  modal = false,
  workspaceId,
  threadId,
  threadModel,
}: {
  modal?: boolean;
  workspaceId: string;
  threadId: string;
  threadModel?: string;
}) {
  const globalSelectedModel = useAgentStore((s) => s.selectedModel);
  const setSelectedModel = useAgentStore((s) => s.setSelectedModel);
  const setSelectedProvider = useAgentStore((s) => s.setSelectedProvider);
  const updateThreadModel = useAgentStore((s) => s.updateThreadModel);
  const modelOptions = useChatEditorStore((s) => s.modelOptions);
  const fetchModelOptions = useChatEditorStore((s) => s.fetchModelOptions);

  const selectedModel = threadModel ?? globalSelectedModel;

  useEffect(() => {
    fetchModelOptions();
  }, [fetchModelOptions]);

  const handleModelChange = (value: string) => {
    if (threadId) {
      void updateThreadModel(workspaceId, threadId, value);
    }
    setSelectedModel(value);
    const opt = modelOptions.find((o) => o.value === value);
    if (opt?.provider) setSelectedProvider(opt.provider);
  };

  if (modelOptions.length === 0) return null;

  return (
    <DropdownMenu modal={modal}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="xs">
          <span className="truncate text-xs">
            {modelOptions.find((o) => o.value === selectedModel)?.label ?? selectedModel}
          </span>
          <ChevronDownIcon className="size-3.5 shrink-0 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[220px]">
        <DropdownMenuRadioGroup value={selectedModel} onValueChange={handleModelChange}>
          {modelOptions.map((opt) => (
            <DropdownMenuRadioItem key={opt.value} value={opt.value}>
              {opt.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

type TaskThreadPreviewProps = {
  thread: ChatThread;
  workspaceId: string;
  workspacePath: string | null;
  currentModel?: string;
  onSent?: () => void;
};

function TaskThreadPreview({ thread, workspaceId, workspacePath, currentModel, onSent }: TaskThreadPreviewProps) {
  const runtime = useAgentStore((s) => s.getThreadRuntime(workspaceId, thread.id));
  const isRunning = runtime.status === "running";
  const stopAgent = useAgentStore((s) => s.stopAgent);
  const startAgent = useAgentStore((s) => s.startAgent);
  const modelToUse = currentModel ?? thread.model;

  return (
    <div className="flex h-[32rem] w-full min-h-0 flex-col overflow-hidden">
      <div className="shrink-0 border-b border-foreground/10 px-3 py-2 flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-muted-foreground">Thread preview</span>
        <div className="flex items-center gap-1">
          {isRunning && (
            <Button
              variant="secondary"
              size="xs"
              onClick={() => void stopAgent(workspaceId)}
              aria-label="Stop agent"
            >
              <StopIcon className="size-3.5" />
              Stop
            </Button>
          )}
          <ModelDropdown modal workspaceId={workspaceId} threadId={thread.id} threadModel={modelToUse} />
        </div>
      </div>
      {runtime.error ? (
        <div className="shrink-0 border-b border-red-500/15 p-3">
          <TaskErrorNotice error={runtime.error} tone="compact" actions={<TaskErrorActions error={runtime.error} />} />
        </div>
      ) : null}
      <div className="min-h-0 w-full flex-1 flex flex-col overflow-hidden">
        <MessageListPreview
          messages={thread.messages}
          className="h-full min-h-0"
          emptyLabel="No messages yet."
          retryAction={{
            enabled: !isRunning,
            onRetry: () => {
              void startAgent(workspaceId, "", {
                threadId: thread.id,
                useExistingPrompt: true,
              });
            },
          }}
        />
      </div>
      <PopoverChatEditor
        workspaceId={workspaceId}
        threadId={thread.id}
        workspacePath={workspacePath}
        navigateOnSend={false}
        onSent={onSent}
      />
    </div>
  );
}

type TaskPreviewPopoverProps = {
  thread: ChatThread;
  workspaceId: string;
  workspacePath: string | null;
  align?: "start" | "end";
  children: React.ReactNode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

type TaskThreadDialogProps = {
  thread: ChatThread;
  workspaceId: string;
  workspacePath: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
};

export function TaskThreadDialog({
  thread,
  workspaceId,
  workspacePath,
  open,
  onOpenChange,
  title,
}: TaskThreadDialogProps) {
  const runtime = useAgentStore((s) => s.getThreadRuntime(workspaceId, thread.id));
  const isRunning = runtime.status === "running";
  const stopAgent = useAgentStore((s) => s.stopAgent);
  const startAgent = useAgentStore((s) => s.startAgent);
  const threadData = useAgentStore((s) => s.workspaces[workspaceId]?.threads.find((t) => t.id === thread.id) ?? thread);
  const currentModel = threadData.model;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl  p-0 bg-background mb-8 overflow-hidden gap-0">
        <DialogHeader className="px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            <DialogTitle className="text-sm font-medium">
              {title ?? "Brainstorm"}
            </DialogTitle>
            <div className="flex-1" />
            <div className="flex items-center gap-1">
              {isRunning && (
                <Button
                  variant="secondary"
                  size="xs"
                  onClick={() => void stopAgent(workspaceId)}
                  aria-label="Stop agent"
                >
                  Stop
                </Button>
              )}
              <ModelDropdown modal workspaceId={workspaceId} threadId={thread.id} threadModel={currentModel} />
            </div>
          </div>
        </DialogHeader>
        <div className="flex h-[46rem] min-h-0 w-full flex-col overflow-hidden">
          {runtime.error ? (
            <div className="shrink-0  px-4 pb-3">
              <TaskErrorNotice error={runtime.error} tone="panel" actions={<TaskErrorActions error={runtime.error} />} />
            </div>
          ) : null}
          <div className="min-h-0 w-full flex-1 flex flex-col overflow-hidden">
            <MessageListPreview
              messages={threadData.messages}
              className="h-full min-h-0"
              emptyLabel="Start the brainstorm conversation."
              retryAction={{
                enabled: !isRunning,
                onRetry: () => {
                  void startAgent(workspaceId, "", {
                    threadId: thread.id,
                    useExistingPrompt: true,
                  });
                },
              }}
            />
          </div>
          <PopoverChatEditor
            workspaceId={workspaceId}
            threadId={thread.id}
            workspacePath={workspacePath}
            navigateOnSend={false}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function TaskPreviewPopover({
  thread,
  workspaceId,
  workspacePath,
  align = "start",
  children,
  open,
  onOpenChange,
}: TaskPreviewPopoverProps) {
  // Subscribe to store for fresh thread data
  const threadData = useAgentStore((s) => s.workspaces[workspaceId]?.threads.find((t) => t.id === thread.id) ?? thread);
  const currentModel = threadData.model;

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent
        sideOffset={12}
        align={align}
        side="right"
        className="w-[26rem] bg-secondary mb-8 max-w-[90vw] overflow-hidden p-0"
      >
        <TaskThreadPreview
          thread={threadData}
          workspaceId={workspaceId}
          workspacePath={workspacePath}
          currentModel={currentModel}
          onSent={() => onOpenChange(false)}
        />
      </PopoverContent>
    </Popover>
  );
}

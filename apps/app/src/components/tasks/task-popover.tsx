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
import { PopoverChatEditor } from "@/components/agent/chat-editor";
import { MessageListPreview } from "@/components/agent/messages";
import { useAgentStore } from "@/store/agent";
import { useChatEditorStore } from "@/store/editor";

function ModelDropdown({ modal = false }: { modal?: boolean }) {
  const selectedModel = useAgentStore((s) => s.selectedModel);
  const setSelectedModel = useAgentStore((s) => s.setSelectedModel);
  const setSelectedProvider = useAgentStore((s) => s.setSelectedProvider);
  const modelOptions = useChatEditorStore((s) => s.modelOptions);
  const fetchModelOptions = useChatEditorStore((s) => s.fetchModelOptions);

  useEffect(() => {
    fetchModelOptions();
  }, [fetchModelOptions]);

  const handleModelChange = (value: string) => {
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
  onSent?: () => void;
};

function TaskThreadPreview({ thread, workspaceId, workspacePath, onSent }: TaskThreadPreviewProps) {
  const isRunning = useAgentStore((s) => s.getThreadRuntime(workspaceId, thread.id).status === "running");
  const stopAgent = useAgentStore((s) => s.stopAgent);

  return (
    <div className="flex h-[32rem] w-full min-h-0 flex-col overflow-hidden">
      <div className="shrink-0 border-b border-foreground/10 px-3 py-2 flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-muted-foreground">Thread preview</span>
        <div className="flex items-center gap-1">
          {isRunning && (
            <Button
              variant="destructive"
              size="xs"
              onClick={() => void stopAgent(workspaceId)}
              aria-label="Stop agent"
            >
              <StopIcon className="size-3.5" />
              Stop
            </Button>
          )}
          <ModelDropdown modal />
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">
        <MessageListPreview
          messages={thread.messages}
          className="h-full min-h-0"
          emptyLabel="No messages yet."
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
  const isRunning = useAgentStore((s) => s.getThreadRuntime(workspaceId, thread.id).status === "running");
  const stopAgent = useAgentStore((s) => s.stopAgent);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl p-0 overflow-hidden gap-0">
        <DialogHeader className="px-4 py-3 border-b border-foreground/10">
          <div className="flex items-center justify-between gap-2">
            <DialogTitle className="text-sm font-medium">
              {title ?? "Brainstorm"}
            </DialogTitle>
            <div className="flex items-center gap-1">
              {isRunning && (
                <Button
                  variant="destructive"
                  size="xs"
                  onClick={() => void stopAgent(workspaceId)}
                  aria-label="Stop agent"
                >
                  <StopIcon className="size-3.5" />
                  Stop
                </Button>
              )}
              <ModelDropdown modal />
            </div>
          </div>
        </DialogHeader>
        <div className="flex h-[36rem] min-h-0 flex-col overflow-hidden">
          <div className="min-h-0 flex-1 overflow-hidden">
            <MessageListPreview
              messages={thread.messages}
              className="h-full min-h-0"
              emptyLabel="Start the brainstorm conversation."
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
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent
        sideOffset={12}
        align={align}
        side="right"
        className="w-[26rem] bg-background! dark:bg-popover! backdrop-blur-none max-w-[90vw] overflow-hidden p-0"
      >
        <TaskThreadPreview
          thread={thread}
          workspaceId={workspaceId}
          workspacePath={workspacePath}
          onSent={() => onOpenChange(false)}
        />
      </PopoverContent>
    </Popover>
  );
}

import { useState } from "react";
import type { AgentMessage } from "@agentide/shared";
import {
  Button,
  CopyIcon,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  PlayIcon,
  Textarea,
  RotateIcon,
} from "@agentide/ui";
import { IconCheck, IconPencil } from "@tabler/icons-react";
import { cn } from "@/lib/cn";
import { UserMessagePreview } from "./mention-chip";
import { useAgentStore } from "@/store/agent";
import { useWorkspaceStore } from "@/store/workspace";
import { getCheckpointForMessage, isCodeRestoreAvailable } from "@/utils/checkpoint";
import { getToolComponent } from "./tools";
import { GenericTool } from "./tools/generic";
import { MarkdownMessage } from "./markdown";

type MessageBubbleProps = {
  message: AgentMessage;
  messageIndex: number;
  isPreview?: boolean;
};



const parseToolInput = (input: unknown): Record<string, unknown> => {
  if (input && typeof input === "object" && !Array.isArray(input)) {
    return input as Record<string, unknown>;
  }
  if (typeof input === "string") {
    try {
      const parsed = JSON.parse(input);
      if (parsed && typeof parsed === "object") return parsed;
    } catch {
      // not json
    }
    return { command: input };
  }
  return { value: input };
};

function parseToolResult(result: unknown): unknown {
  if (result === undefined || result === null) return undefined;
  if (typeof result === "object" && !Array.isArray(result)) return result;
  if (typeof result === "string") {
    try {
      const parsed = JSON.parse(result);
      return parsed;
    } catch {
      return result;
    }
  }
  return result;
}

const ToolMessage = ({ message }: { message: AgentMessage }) => {
  const toolName = message.toolName ?? "";
  const toolInput = parseToolInput(message.toolInput);
  const toolResult = parseToolResult(message.toolResult);
  const ToolComponent = getToolComponent(toolName);
  const Component = ToolComponent ?? GenericTool;

  return (
    <div className="px-4 py-2">
      <Component message={message} toolInput={toolInput} toolResult={toolResult} />
    </div>
  );
};

function formatTokens(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return n.toString();
}

function MessageUsageFooter({ message }: { message: AgentMessage }) {
  const input = message.inputTokens ?? 0;
  const output = message.outputTokens ?? 0;
  const cost = message.costUsd ?? 0;
  if (input === 0 && output === 0 && cost === 0) return null;
  return (
    <div className="mt-1.5 flex items-center gap-3 text-[11px] text-muted-foreground">
      {(input > 0 || output > 0) && (
        <span className="tabular-nums">
          {input > 0 && <>{formatTokens(input)} in</>}
          {input > 0 && output > 0 && " · "}
          {output > 0 && <>{formatTokens(output)} out</>}
        </span>
      )}
      {cost > 0 && (
        <span className="tabular-nums">
          ${cost < 0.01 ? cost.toFixed(4) : cost.toFixed(3)}
        </span>
      )}
    </div>
  );
}

function PlanBuildFooter({ message }: { message: AgentMessage }) {
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const buildFromPlan = useAgentStore((s) => s.buildFromPlan);
  const updateMessageContent = useAgentStore((s) => s.updateMessageContent);
  const activeThread = useAgentStore((s) =>
    activeWorkspaceId ? s.getActiveThread(activeWorkspaceId) : null
  );
  const runtime = useAgentStore((s) =>
    s.getActiveRuntime(activeWorkspaceId ?? "")
  );
  const isRunning = runtime.status === "running";

  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState("");

  const planContent = message.planContent ?? "";

  const handleBuild = () => {
    if (!activeWorkspaceId || isRunning) return;
    buildFromPlan(activeWorkspaceId, planContent);
  };

  const handleStartEdit = () => {
    setEditValue(planContent);
    setIsEditing(true);
  };

  const handleSave = async () => {
    if (!activeWorkspaceId || !activeThread) return;
    await updateMessageContent(
      activeWorkspaceId,
      activeThread.id,
      message.id,
      { planContent: editValue, content: editValue }
    );
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <div className="mt-3 flex flex-col gap-2">
        <Textarea
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          className="w-full min-h-[200px] resize-y font-mono text-sm"
          autoFocus
        />
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={handleSave}>
            Save
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setIsEditing(false)}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-3 flex items-center gap-2">
      <Button
        size="sm"
        variant="brand"
        onClick={handleBuild}
        disabled={!activeWorkspaceId || isRunning}
      >
        <PlayIcon className="size-3.5 mr-1.5" />
        Build from Plan
      </Button>
      <Button
        size="sm"
        variant="secondary"
        onClick={handleStartEdit}
        disabled={isRunning}
      >
        <IconPencil className="size-3.5 mr-1.5" />
        Edit Plan
      </Button>
    </div>
  );
}

function ReviewFooter({ message }: { message: AgentMessage }) {
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const updateMessageContent = useAgentStore((s) => s.updateMessageContent);
  const activeThread = useAgentStore((s) =>
    activeWorkspaceId ? s.getActiveThread(activeWorkspaceId) : null
  );
  const runtime = useAgentStore((s) =>
    s.getActiveRuntime(activeWorkspaceId ?? "")
  );
  const isRunning = runtime.status === "running";

  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState("");

  const reviewContent = message.reviewContent ?? "";

  const handleStartEdit = () => {
    setEditValue(reviewContent);
    setIsEditing(true);
  };

  const handleSave = async () => {
    if (!activeWorkspaceId || !activeThread) return;
    await updateMessageContent(
      activeWorkspaceId,
      activeThread.id,
      message.id,
      { reviewContent: editValue, content: editValue }
    );
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <div className="mt-3 flex flex-col gap-2">
        <Textarea
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          className="w-full min-h-[200px] resize-y font-mono text-sm"
          autoFocus
        />
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={handleSave}>
            Save
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setIsEditing(false)}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-3 flex items-center gap-2">
      <Button
        size="sm"
        variant="secondary"
        onClick={handleStartEdit}
        disabled={isRunning}
      >
        <IconPencil className="size-3.5 mr-1.5" />
        Edit Review
      </Button>
    </div>
  );
}

export const MessageBubble = ({ message, messageIndex, isPreview = false }: MessageBubbleProps) => {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === "user";
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const activeThread = useAgentStore((s) =>
    activeWorkspaceId ? s.getActiveThread(activeWorkspaceId) : null
  );
  const rewindToCheckpoint = useAgentStore((s) => s.rewindToCheckpoint);
  const activeWorkspace = useWorkspaceStore((s) =>
    s.workspaces.find((w) => w.id === s.activeWorkspaceId) ?? null
  );
  const checkpoint = isPreview ? null : getCheckpointForMessage(activeThread, messageIndex);

  if (message.role === "tool") {
    return <ToolMessage message={message} />;
  }

  const codeRestoreAvailable = checkpoint ? isCodeRestoreAvailable(checkpoint) : false;
  const isPlanMessage = !isUser && !!message.planContent && !message.isPartial;
  const isReviewMessage = !isUser && !!message.reviewContent && !message.isPartial;

  const handleCopyMarkdown = async () => {
    await navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={cn("flex gap-3 px-4 py-3 w-full min-w-0 group", isPreview && "max-w-full")}>
      <div
        className={cn(
          "rounded-lg super-ellipse py-1 text-sm leading-relaxed flex-1 min-w-0",
          isPreview ? "max-w-full break-words" : "max-w-2xl",
          isUser
            ? "bg-foreground/10 px-3 !text-white [&_[data-type=mention]]:font-medium [&_[data-type=mention]]:text-accent-foreground"
            : "bg-transparent w-full px-0 py-0 text-foreground [&_[data-type=mention]]:font-medium [&_[data-type=mention]]:text-accent-foreground"
        )}
      >
        {isUser ? (
          <UserMessagePreview content={message.content} />
        ) : (
          <div className="py-1">
            <MarkdownMessage content={message.content} />
          </div>
        )}
        {isPlanMessage && !isPreview && <PlanBuildFooter message={message} />}
        {isReviewMessage && !isPreview && <ReviewFooter message={message} />}
        <MessageUsageFooter message={message} />
      </div>
      {isUser && !isPreview && checkpoint && activeWorkspace && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              size="icon-sm"
              variant="ghost"
              className="opacity-0 group-hover:opacity-100 shrink-0 h-7 w-7"
            >
              <RotateIcon className="size-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={() =>
                rewindToCheckpoint(activeWorkspace.id, checkpoint.id, "both")
              }
              disabled={!codeRestoreAvailable}
            >
              Restore code & conversation
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() =>
                rewindToCheckpoint(activeWorkspace.id, checkpoint.id, "conversation")
              }
            >
              Restore conversation only
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() =>
                rewindToCheckpoint(activeWorkspace.id, checkpoint.id, "code")
              }
              disabled={!codeRestoreAvailable}
            >
              Restore code only
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      {!isUser && !isPreview && message.content && (
        <Button
          size="icon-sm"
          variant="ghost"
          className="opacity-0 group-hover:opacity-100 shrink-0 h-7 w-7"
          onClick={handleCopyMarkdown}
          aria-label={copied ? "Copied" : "Copy markdown"}
        >
          {copied ? <IconCheck className="size-3.5" /> : <CopyIcon className="size-3.5" />}
        </Button>
      )}
    </div>
  );
};

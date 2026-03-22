import { useState } from "react";
import type { AgentMessage } from "@openade/shared";
import {
  Button,
  CopyIcon,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  PlayIcon,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Textarea,
  RotateIcon,
} from "@openade/ui";
import { IconCheck, IconInfoCircle, IconPencil } from "@tabler/icons-react";
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

function MessageUsageFooter({
  message,
  copyAction,
}: {
  message: AgentMessage;
  copyAction?: {
    onCopy: () => void;
    copied: boolean;
  };
}) {
  const input = message.inputTokens ?? 0;
  const output = message.outputTokens ?? 0;
  const cost = message.costUsd ?? 0;
  const hasUsage = input > 0 || output > 0 || cost > 0;

  if (!hasUsage && !copyAction) return null;

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
      {copyAction && (
        <Button
          size="icon-sm"
          variant="ghost"
          className="h-6 w-6 text-muted-foreground"
          onClick={copyAction.onCopy}
          aria-label={copyAction.copied ? "Copied" : "Copy markdown"}
        >
          {copyAction.copied ? <IconCheck className="size-3.5" /> : <CopyIcon className="size-3.5" />}
        </Button>
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

function ContextMessageList({ summaries }: { summaries: NonNullable<AgentMessage["contextInfo"]>["messageSummaries"] }) {
  if (!summaries || summaries.length === 0) return null;

  const roleColors: Record<string, string> = {
    user: "text-blue-400",
    assistant: "text-green-400",
    tool: "text-yellow-400",
    system: "text-purple-400",
  };

  const roleBg: Record<string, string> = {
    user: "bg-blue-500/10",
    assistant: "bg-green-500/10",
    tool: "bg-yellow-500/10",
    system: "bg-purple-500/10",
  };

  return (
    <div className="space-y-1.5 max-h-[50vh] overflow-y-auto">
      {summaries.map((msg, idx) => (
        <div key={msg.id} className={cn("rounded px-2 py-1.5 text-[10px]", roleBg[msg.role] ?? "bg-muted")}>
          <div className="flex items-center gap-2 mb-1">
            <span className="shrink-0 text-muted-foreground/60 tabular-nums font-mono">#{idx + 1}</span>
            <span className={cn("font-mono font-medium px-1.5 py-0.5 rounded text-[9px]", roleColors[msg.role] ?? "text-muted-foreground", roleBg[msg.role])}>
              {msg.role === "tool" ? `${msg.toolName ?? "tool"}` : msg.role.toUpperCase()}
            </span>
          </div>
          <div className="text-muted-foreground whitespace-pre-wrap break-words font-mono text-[9px] leading-relaxed">
            {msg.preview || "(empty)"}
          </div>
        </div>
      ))}
    </div>
  );
}

function UserMessageContextPopover({ message }: { message: AgentMessage }) {
  const contextInfo = message.contextInfo;
  if (!contextInfo) {
    return (
      <span className="text-[10px] text-muted-foreground/50 px-2 py-0.5">
        (no context info)
      </span>
    );
  }

  const hasSummaries = contextInfo.messageSummaries && contextInfo.messageSummaries.length > 0;
  const toolCount = contextInfo.messageSummaries?.filter((m) => m.role === "tool").length ?? 0;
  const userCount = contextInfo.messageSummaries?.filter((m) => m.role === "user").length ?? 0;
  const assistantCount = contextInfo.messageSummaries?.filter((m) => m.role === "assistant").length ?? 0;
  
  const debugInfo = {
    hasContextInfo: !!contextInfo,
    previousMessages: contextInfo.previousMessages,
    hasSummariesArray: !!contextInfo.messageSummaries,
    summariesLength: contextInfo.messageSummaries?.length ?? 0,
    estimatedTokens: contextInfo.estimatedTokens,
    keys: Object.keys(contextInfo),
  };

  const tokenDisplay = contextInfo.estimatedTokens 
    ? `~${(contextInfo.estimatedTokens / 1000).toFixed(1)}k tokens`
    : null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[10px] font-medium rounded-full bg-foreground/5 text-muted-foreground hover:bg-foreground/10 hover:text-foreground transition-colors"
        >
          <IconInfoCircle className="size-3" />
          <span>{contextInfo.previousMessages} msgs</span>
          {tokenDisplay && (
            <>
              <span className="text-muted-foreground/40">|</span>
              <span className="text-orange-400">{tokenDisplay}</span>
            </>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" side="top" className="w-[32rem] p-4 max-h-[80vh] overflow-y-auto">
        <div className="space-y-4 text-xs">
          <div className="flex items-center justify-between">
            <div className="font-medium text-foreground text-sm">Context Debug Info</div>
            {contextInfo.wasCompacted && (
              <span className="px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 text-[10px] font-medium">
                COMPACTED
              </span>
            )}
          </div>

          <div className="grid grid-cols-5 gap-2">
            <div className="rounded-md bg-secondary p-2 text-center">
              <div className="text-lg font-semibold tabular-nums">{contextInfo.previousMessages}</div>
              <div className="text-[10px] text-muted-foreground">messages</div>
            </div>
            {contextInfo.estimatedTokens && (
              <div className="rounded-md bg-orange-500/10 p-2 text-center">
                <div className="text-lg font-semibold tabular-nums text-orange-400">
                  {(contextInfo.estimatedTokens / 1000).toFixed(1)}k
                </div>
                <div className="text-[10px] text-muted-foreground">est. tokens</div>
              </div>
            )}
            {hasSummaries && (
              <>
                <div className="rounded-md bg-blue-500/10 p-2 text-center">
                  <div className="text-lg font-semibold tabular-nums text-blue-400">{userCount}</div>
                  <div className="text-[10px] text-muted-foreground">user</div>
                </div>
                <div className="rounded-md bg-yellow-500/10 p-2 text-center">
                  <div className="text-lg font-semibold tabular-nums text-yellow-400">{toolCount}</div>
                  <div className="text-[10px] text-muted-foreground">tool calls</div>
                </div>
              </>
            )}
          </div>

          {hasSummaries && (
            <div className="space-y-2">
              <div className="font-medium text-foreground">
                Recent Messages in context ({contextInfo.messageSummaries?.length})
              </div>
              <div className="rounded-md bg-secondary p-2">
                <ContextMessageList summaries={contextInfo.messageSummaries} />
              </div>
            </div>
          )}

          <div className="space-y-2">
            <div className="font-medium text-foreground">Resolved prompt</div>
            <div className="max-h-32 overflow-y-auto whitespace-pre-wrap rounded-md bg-secondary p-2 text-muted-foreground font-mono text-[10px]">
              {contextInfo.prompt}
            </div>
          </div>

          {contextInfo.generatedSystemPrompt ? (
            <div className="space-y-2">
              <div className="font-medium text-foreground">Generated system prompt</div>
              <div className="max-h-40 overflow-y-auto whitespace-pre-wrap rounded-md bg-secondary p-2 text-muted-foreground font-mono text-[10px]">
                {contextInfo.generatedSystemPrompt}
              </div>
            </div>
          ) : null}

          {contextInfo.systemPrompt ? (
            <div className="space-y-2">
              <div className="font-medium text-foreground">System prompt override</div>
              <div className="max-h-40 overflow-y-auto whitespace-pre-wrap rounded-md bg-secondary p-2 text-muted-foreground font-mono text-[10px]">
                {contextInfo.systemPrompt}
              </div>
            </div>
          ) : null}

          <div className="space-y-2 border-t border-foreground/10 pt-3 mt-3">
            <div className="font-medium text-foreground text-[10px] text-muted-foreground">Debug Info</div>
            <div className="rounded-md bg-secondary p-2 text-muted-foreground font-mono text-[9px] whitespace-pre-wrap">
              {JSON.stringify(debugInfo, null, 2)}
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
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
          <div className="flex flex-col gap-1.5">
            <div className="min-w-0 flex-1">
              <UserMessagePreview content={message.content} />
            </div>
            <UserMessageContextPopover message={message} />
          </div>
        ) : (
          <div className="py-1">
            <MarkdownMessage content={message.content} />
          </div>
        )}
        {isPlanMessage && !isPreview && <PlanBuildFooter message={message} />}
        {isReviewMessage && !isPreview && <ReviewFooter message={message} />}
        <MessageUsageFooter
          message={message}
          copyAction={
            !isUser && message.content
              ? {
                  onCopy: handleCopyMarkdown,
                  copied,
                }
              : undefined
          }
        />
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
    </div>
  );
};

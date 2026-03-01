import type { AgentMessage } from "@agentide/shared";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  RotateIcon,
} from "@agentide/ui";
import { cn } from "@/lib/cn";
import { useAgentStore } from "@/store/agent.store";
import { useWorkspaceStore } from "@/store/workspace.store";
import { getCheckpointForMessage, isCodeRestoreAvailable } from "@/utils/checkpoint";
import { getToolComponent } from "./tools";
import { GenericTool } from "./tools/generic-tool";
import { MarkdownMessage } from "./markdown-message";

type MessageBubbleProps = {
  message: AgentMessage;
  messageIndex: number;
};

type NormalizedPart = { type: "text"; value: string } | { type: "mention"; label: string; id: string };

function unescapeHtml(html: string): string {
  return html
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function normalizeUserContent(content: string): NormalizedPart[] {
  const trimmed = content.trim();
  if (!trimmed) return [];
  const unescaped = unescapeHtml(trimmed);
  const looksLikeHtml = /<[^>]+>/.test(unescaped) && /data-type\s*=\s*["']mention["']/.test(unescaped);
  if (looksLikeHtml) {
    try {
      const doc = new DOMParser().parseFromString(unescaped, "text/html");
      const parts: NormalizedPart[] = [];
      const walk = (node: Node) => {
        if (node.nodeType === Node.TEXT_NODE && node.textContent) {
          parts.push({ type: "text", value: node.textContent });
          return;
        }
        if (node.nodeType !== Node.ELEMENT_NODE) return;
        const el = node as Element;
        if (el.getAttribute?.("data-type") === "mention") {
          const id = el.getAttribute("data-id") ?? "";
          const labelAttr = el.getAttribute("data-label");
          const label = (labelAttr ?? ((el.textContent?.trim() || id) || "@")).trim();
          parts.push({ type: "mention", label: label.startsWith("@") ? label : `@${label}`, id });
          return;
        }
        for (const child of el.childNodes) walk(child);
      };
      walk(doc.body);
      if (parts.length > 0) return parts;
      const stripped = unescaped.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      return [{ type: "text", value: stripped || trimmed }];
    } catch {
      const stripped = unescaped.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      return [{ type: "text", value: stripped || trimmed }];
    }
  }
  const mentionRe = /(@[\w./-]+)/g;
  const segments = trimmed.split(mentionRe);
  if (segments.length <= 1) return [{ type: "text", value: trimmed }];
  return segments.map((seg) =>
    /^@[\w./-]+$/.test(seg)
      ? { type: "mention" as const, label: seg.startsWith("@") ? seg : `@${seg}`, id: seg }
      : { type: "text" as const, value: seg }
  );
}

function UserMessageContent({ content }: { content: string }) {
  const parts = normalizeUserContent(content);
  const hasMentions = parts.some((p) => p.type === "mention");
  if (!hasMentions && parts.length === 1 && parts[0].type === "text") {
    return <span className="whitespace-pre-wrap wrap-break-word">{parts[0].value}</span>;
  }
  return (
    <span className="whitespace-pre-wrap wrap-break-word">
      {parts.map((p, i) =>
        p.type === "text" ? (
          <span key={i}>{p.value}</span>
        ) : (
          <span key={i} data-type="mention" className="font-medium text-accent">
            {p.label}
          </span>
        )
      )}
    </span>
  );
}

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

export const MessageBubble = ({ message, messageIndex }: MessageBubbleProps) => {
  const isUser = message.role === "user";
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const activeThread = useAgentStore((s) =>
    activeWorkspaceId ? s.getActiveThread(activeWorkspaceId) : null
  );
  const rewindToCheckpoint = useAgentStore((s) => s.rewindToCheckpoint);
  const activeWorkspace = useWorkspaceStore((s) =>
    s.workspaces.find((w) => w.id === s.activeWorkspaceId) ?? null
  );
  const checkpoint = getCheckpointForMessage(activeThread, messageIndex);

  if (message.role === "tool") {
    return <ToolMessage message={message} />;
  }

  const codeRestoreAvailable = isCodeRestoreAvailable(checkpoint);

  return (
    <div className="flex gap-3 px-4 py-3 w-full group">
      <div
        className={cn(
          "max-w-2xl rounded-lg super-ellipse py-1 text-sm leading-relaxed flex-1 min-w-0",
          isUser
            ? "bg-foreground/10 px-3 !text-white [&_[data-type=mention]]:font-medium [&_[data-type=mention]]:text-accent"
            : "bg-transparent w-full px-0 py-0 text-foreground [&_[data-type=mention]]:font-medium [&_[data-type=mention]]:text-accent"
        )}
      >
        {isUser ? (
          <UserMessageContent content={message.content} />
        ) : (
          <div className="py-1">
            <MarkdownMessage content={message.content} />
          </div>
        )}
        <MessageUsageFooter message={message} />
      </div>
      {isUser && checkpoint && activeWorkspace && (
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

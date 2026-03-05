import { useMemo } from "react";
import type { AgentMessage } from "@agentide/shared";
import { LlmChatIcon } from "@agentide/ui";
import { useStickToBottom } from "use-stick-to-bottom";
import { cn } from "@/lib/cn";
import { useAgentStore } from "@/store/agent";
import { useWorkspaceStore } from "@/store/workspace";
import { MessageBubble } from "./bubble";
import { MarkdownMessage } from "./markdown";
import { ToolCallGroup } from "./tools/group";
import { getToolGroupKey } from "./tools/labels";

const EMPTY_MESSAGES: AgentMessage[] = [];
const EMPTY_ACTIVE_TOOLS: AgentMessage[] = [];

type RenderItem =
  | { type: "message"; message: AgentMessage; messageIndex: number }
  | { type: "toolGroup"; messages: AgentMessage[] };

function buildRenderItems(messages: AgentMessage[]): RenderItem[] {
  const items: RenderItem[] = [];
  let i = 0;
  while (i < messages.length) {
    const msg = messages[i];
    if (msg.role !== "tool") {
      items.push({ type: "message", message: msg, messageIndex: i });
      i += 1;
      continue;
    }
    const groupKey = getToolGroupKey(msg.toolName);
    const chunk: AgentMessage[] = [msg];
    i += 1;
    while (
      i < messages.length &&
      messages[i].role === "tool" &&
      getToolGroupKey(messages[i].toolName) === groupKey
    ) {
      chunk.push(messages[i]);
      i += 1;
    }
    items.push({ type: "toolGroup", messages: chunk });
  }
  return items;
}

type MessageListPreviewProps = {
  messages: AgentMessage[];
  className?: string;
  emptyLabel?: string;
};

export const MessageListPreview = ({
  messages,
  className,
  emptyLabel = "No conversation yet",
}: MessageListPreviewProps) => {
  const { scrollRef, contentRef } = useStickToBottom();

  return (
    <div
      ref={scrollRef}
      className={cn(
        "flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-auto [scrollbar-gutter:stable]",
        className
      )}
    >
      <div ref={contentRef} className="mx-auto flex w-full min-w-0 max-w-full flex-col gap-1 py-4">
        {messages.length === 0 ? (
          <div className="flex h-full min-h-0 flex-1 flex-col items-center justify-center gap-2 px-6 py-8 text-xs text-muted-foreground">
            {emptyLabel}
          </div>
        ) : (
          buildRenderItems(messages).map((item) =>
            item.type === "message" ? (
              <MessageBubble
                key={item.message.id}
                message={item.message}
                messageIndex={item.messageIndex}
                isPreview
              />
            ) : (
              <ToolCallGroup key={item.messages.map((m) => m.id).join(",")} messages={item.messages} />
            )
          )
        )}
      </div>
    </div>
  );
};

export const MessageList = () => {
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const messages = useAgentStore((s) =>
    s.getActiveThread(activeWorkspaceId ?? "")?.messages ?? EMPTY_MESSAGES
  );
  const activeToolCalls = useAgentStore((s) =>
    s.getActiveRuntime(activeWorkspaceId ?? "").activeToolCalls ?? EMPTY_ACTIVE_TOOLS
  );
  const streamingText = useAgentStore((s) =>
    s.getActiveRuntime(activeWorkspaceId ?? "").streamingText
  );
  const status = useAgentStore((s) =>
    s.getActiveRuntime(activeWorkspaceId ?? "").status
  );
  const activeThreadId = useAgentStore((s) =>
    s.getWorkspaceState(activeWorkspaceId ?? "").activeThreadId
  );
  const { scrollRef, contentRef } = useStickToBottom();

  const allMessages = useMemo(() => {
    if (activeToolCalls.length === 0) return messages;
    return [...messages, ...activeToolCalls];
  }, [messages, activeToolCalls]);

  const isEmpty = allMessages.length === 0 && !streamingText;

  return (
    <div
      ref={scrollRef}
      className="flex h-full min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto [scrollbar-gutter:stable]"
    >
      {isEmpty ? (
        <div className="flex h-full min-h-0 flex-1 flex-col items-center justify-center gap-4 text-muted-foreground">
          <LlmChatIcon className="size-8 text-foreground/50" />
          <div className="text-center">
            <p className="text-sm font-medium text-muted-foreground">No conversation yet</p>
            <p className="mt-1 text-xs text-foreground/50">
              Select a workspace and send a prompt to start
            </p>
          </div>
        </div>
      ) : (
        <div key={activeThreadId} ref={contentRef} className="mx-auto flex w-full max-w-[38rem] flex-col gap-1 py-4">
          {buildRenderItems(allMessages).map((item) =>
            item.type === "message" ? (
              <MessageBubble
                key={item.message.id}
                message={item.message}
                messageIndex={item.messageIndex}
              />
            ) : (
              <ToolCallGroup key={item.messages.map((m) => m.id).join(",")} messages={item.messages} />
            )
          )}

          {streamingText && (
            <div className="flex gap-3 px-4 py-3 w-full">
              <div className="max-w-2xl rounded-lg super-ellipse w-full px-0 py-0 text-foreground text-sm leading-relaxed [&_[data-type=mention]]:font-medium [&_[data-type=mention]]:text-accent">
                <div className="py-1">
                  <MarkdownMessage content={streamingText} />
                  <span className="inline-block h-4 w-1 animate-pulse bg-accent ml-1" />
                </div>
              </div>
            </div>
          )}

          {status === "running" && !streamingText && activeToolCalls.length === 0 && (
            <div className="flex gap-3 py-3">
              <div className="flex max-w-2xl items-center gap-0.5 rounded-2xl px-2 py-1">
                <span className="h-1 w-1 animate-bounce rounded-full bg-foreground/50 [animation-delay:0ms]" />
                <span className="h-1 w-1 animate-bounce rounded-full bg-foreground/50 [animation-delay:150ms]" />
                <span className="h-1 w-1 animate-bounce rounded-full bg-foreground/50 [animation-delay:300ms]" />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

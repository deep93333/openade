import { useEffect, useRef } from "react";
import type { AgentMessage } from "@agentide/shared";
import { LlmChatIcon } from "@agentide/ui";
import { useAgentStore } from "@/store/agent.store";
import { useWorkspaceStore } from "@/store/workspace.store";
import { MessageBubble } from "./message-bubble";
import { MarkdownMessage } from "./markdown-message";

const EMPTY_MESSAGES: AgentMessage[] = [];

export const MessageList = () => {
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const messages = useAgentStore((s) =>
    s.getActiveThread(activeWorkspaceId ?? "")?.messages ?? EMPTY_MESSAGES
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
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingText]);

  if (messages.length === 0 && !streamingText) {
    return (
      <div className="flex h-full min-h-0 flex-1 flex-col items-center justify-center gap-4 text-muted-foreground">
        <LlmChatIcon className="size-8 text-foreground/50" />
        <div className="text-center">
          <p className="text-sm font-medium text-muted-foreground">No conversation yet</p>
          <p className="mt-1 text-xs text-foreground/50">
            Select a workspace and send a prompt to start
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      key={activeThreadId}
      className="flex h-full min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto [scrollbar-gutter:stable]"
    >
      <div className="mx-auto flex w-full max-w-[38rem] flex-col gap-1 py-4">
        {messages.map((message, index) => (
          <MessageBubble key={message.id} message={message} messageIndex={index} />
        ))}

        {streamingText && (
          <div className="flex gap-3 px-4 py-3 w-full">
            <div className="max-w-2xl rounded-lg super-ellipse w-full px-0 py-0 text-foreground text-sm leading-relaxed [&_[data-type=mention]]:bg-accent/20 [&_[data-type=mention]]:text-accent-foreground [&_[data-type=mention]]:rounded [&_[data-type=mention]]:px-1">
              <div className="py-1">
                <MarkdownMessage content={streamingText} />
                <span className="inline-block h-4 w-1 animate-pulse bg-accent ml-1" />
              </div>
            </div>
          </div>
        )}

        {status === "running" && !streamingText && (
          <div className="flex gap-3 py-3">
            <div className="flex max-w-2xl items-center gap-0.5 rounded-2xl px-2 py-1">
              <span className="h-1 w-1 animate-bounce rounded-full bg-foreground/50 [animation-delay:0ms]" />
              <span className="h-1 w-1 animate-bounce rounded-full bg-foreground/50 [animation-delay:150ms]" />
              <span className="h-1 w-1 animate-bounce rounded-full bg-foreground/50 [animation-delay:300ms]" />
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>
    </div>
  );
};

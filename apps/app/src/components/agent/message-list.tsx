import { useEffect, useRef } from "react";
import { LlmChatIcon } from "@agentide/ui";
import { useAgentStore } from "@/store/agent.store";
import { MessageBubble } from "./message-bubble";

export const MessageList = () => {
  const messages = useAgentStore((s) => s.messages);
  const streamingText = useAgentStore((s) => s.streamingText);
  const status = useAgentStore((s) => s.status);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingText]);

  if (messages.length === 0 && !streamingText) {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 text-zinc-600">
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
    <div className="flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto [scrollbar-gutter:stable]">
      <div className="flex flex-col gap-1 py-4 max-w-[38rem] mx-auto">
        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}

        {streamingText && (
          <div className="flex gap-3 py-3">
            <div className="max-w-2xl rounded-2xl bg-secondary px-4 py-2.5 text-sm leading-relaxed text-foreground">
              <p className="whitespace-pre-wrap break-words">{streamingText}</p>
              <span className="inline-block h-4 w-1 animate-pulse bg-accent" />
            </div>
          </div>
        )}

        {status === "running" && !streamingText && (
          <div className="flex gap-3 py-3">
            <div className="flex max-w-2xl items-center gap-1.5 rounded-2xl bg-secondary px-4 py-3">
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted [animation-delay:0ms]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted [animation-delay:150ms]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted [animation-delay:300ms]" />
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>
    </div>
  );
};

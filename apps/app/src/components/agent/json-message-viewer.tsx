import { useCallback, useRef } from "react";
import type { AgentMessage } from "@agentide/shared";
import { Button } from "@agentide/ui";
import { useAgentStore } from "@/store/agent.store";
import { useWorkspaceStore } from "@/store/workspace.store";

const EMPTY_MESSAGES: AgentMessage[] = [];

export const JsonMessageViewer = () => {
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const messages = useAgentStore((s) =>
    s.getActiveThread(activeWorkspaceId ?? "")?.messages ?? EMPTY_MESSAGES
  );
  const containerRef = useRef<HTMLDivElement>(null);

  const handleCopy = useCallback(() => {
    const json = JSON.stringify(messages, null, 2);
    void navigator.clipboard.writeText(json);
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div className="flex h-full min-h-0 flex-1 flex-col items-center justify-center gap-2 text-muted-foreground">
        <p className="text-sm font-medium">No messages</p>
        <p className="text-xs text-foreground/50">
          Start a conversation to see raw JSON here
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex items-center justify-end px-4 py-2 border-b border-border/50">
        <Button
          size="sm"
          variant="ghost"
          className="h-7 gap-1.5 text-xs text-muted-foreground"
          onClick={handleCopy}
        >
          <svg className="size-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
            />
          </svg>
          Copy JSON
        </Button>
      </div>
      <div
        ref={containerRef}
        className="flex-1 min-h-0 overflow-auto p-4 [scrollbar-gutter:stable]"
      >
        <pre className="text-xs font-mono leading-relaxed text-foreground/80 whitespace-pre-wrap wrap-break-word">
          {JSON.stringify(messages, null, 2)}
        </pre>
      </div>
    </div>
  );
};

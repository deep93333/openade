import { Button, Popover, PopoverContent, PopoverTrigger } from "@agentide/ui";
import { useAgentStore } from "@/store/agent.store";
import { useWorkspaceStore } from "@/store/workspace.store";
import { IconChartBar } from "@tabler/icons-react";

const MODEL_CONTEXT_WINDOW: Record<string, number> = {
  "claude-sonnet-4-6": 200_000,
  "claude-opus-4-6": 200_000,
  "claude-haiku-4-5": 200_000,
  "claude-sonnet-4-20250514": 200_000,
  "gpt-5.2": 128_000,
  "gpt-5-mini": 128_000,
  "gpt-5.2-codex": 400_000,
  "gpt-5.3-codex": 400_000,
  "gpt-5.1-codex-mini": 400_000,
};

const DEFAULT_CONTEXT_WINDOW = 200_000;

function formatTokens(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return n.toString();
}

export const TokenUsagePopover = () => {
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const getActiveThread = useAgentStore((s) => s.getActiveThread);
  const selectedModel = useAgentStore((s) => s.selectedModel);

  const activeThread = activeWorkspaceId ? getActiveThread(activeWorkspaceId) : null;
  const inputTokens = activeThread?.inputTokens ?? 0;
  const outputTokens = activeThread?.outputTokens ?? 0;
  const lastRunInput = activeThread?.lastRunInputTokens ?? 0;
  const lastRunOutput = activeThread?.lastRunOutputTokens ?? 0;

  const contextWindow = MODEL_CONTEXT_WINDOW[selectedModel] ?? DEFAULT_CONTEXT_WINDOW;
  const totalUsed = inputTokens + outputTokens;
  const estimatedRemaining = Math.max(0, contextWindow - lastRunInput);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="xs"
          title="Token usage"
        >
          <IconChartBar stroke={1} className="size-3.5 shrink-0" />
          <span className="text-xxs">
            {formatTokens(totalUsed)} tokens
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" side="top" className="w-64">
        <div className="space-y-3">
          <div className="text-sm font-medium text-foreground">Token usage (this thread)</div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span>Input</span>
            <span className="text-right font-mono">{formatTokens(inputTokens)}</span>
            <span>Output</span>
            <span className="text-right font-mono">{formatTokens(outputTokens)}</span>
            <span>Last run</span>
            <span className="text-right font-mono">
              {formatTokens(lastRunInput + lastRunOutput)}
            </span>
            <span>Context window</span>
            <span className="text-right font-mono">{formatTokens(contextWindow)}</span>
            <span>Est. remaining</span>
            <span className="text-right font-mono">{formatTokens(estimatedRemaining)}</span>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};

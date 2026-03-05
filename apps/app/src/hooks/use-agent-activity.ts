import { useMemo } from "react";
import { useAgentStore } from "@/store/agent";
import { getToolTitle } from "@/components/agent/tools/labels";

export function useAgentActivity(workspaceId: string, threadId: string): {
  isRunning: boolean;
  activity: string | null;
} {
  const runtime = useAgentStore((s) => s.getThreadRuntime(workspaceId, threadId));

  const activity = useMemo(() => {
    if (runtime.status !== "running") return null;

    if (runtime.activeToolCalls.length > 0) {
      const latest = runtime.activeToolCalls[runtime.activeToolCalls.length - 1];
      const input = (latest.toolInput ?? {}) as Record<string, unknown>;
      return getToolTitle(latest.toolName, input, true);
    }

    if (runtime.streamingText) return "Thinking...";
    if (runtime.lastCompletedActivity) return runtime.lastCompletedActivity;
    return "Starting...";
  }, [runtime.status, runtime.activeToolCalls, runtime.streamingText, runtime.lastCompletedActivity]);

  return {
    isRunning: runtime.status === "running",
    activity,
  };
}

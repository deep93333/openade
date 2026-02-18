import type { AgentMessage, AgentResult, AgentStatus } from "@agentide/shared";
import { ulid } from "ulid";

type ToolApprovalResult =
  | { behavior: "allow"; updatedInput?: unknown }
  | { behavior: "deny"; message: string };

type AgentStartOptions = {
  prompt: string;
  workspaceId: string;
  workspacePath: string;
  model?: string;
  resumeSessionId?: string;
  canUseTool?: (toolName: string, input: unknown) => Promise<ToolApprovalResult>;
  onMessage: (message: AgentMessage) => void;
  onResult: (result: AgentResult) => void;
  onError: (error: string) => void;
  onSdkSessionId?: (sdkSessionId: string) => void;
};

type ActiveSession = {
  sessionId: string;
  abortController: AbortController;
  status: AgentStatus;
};

class AgentManager {
  private activeSession: ActiveSession | null = null;

  async start(options: AgentStartOptions): Promise<string> {
    if (this.activeSession?.status === "running") {
      await this.stop(this.activeSession.sessionId);
    }

    const sessionId = ulid();
    const abortController = new AbortController();

    this.activeSession = {
      sessionId,
      abortController,
      status: "running",
    };

    this.runAgent(sessionId, abortController, options).catch((error) => {
      options.onError(error instanceof Error ? error.message : "Unknown agent error");
      if (this.activeSession?.sessionId === sessionId) {
        this.activeSession.status = "error";
      }
    });

    return sessionId;
  }

  private async runAgent(
    sessionId: string,
    abortController: AbortController,
    options: AgentStartOptions
  ): Promise<void> {
    try {
      const { query } = await import("@anthropic-ai/claude-agent-sdk");

      const agentQuery = query({
        prompt: options.prompt,
        options: {
          cwd: options.workspacePath,
          abortController,
          includePartialMessages: true,
          ...(options.model && { model: options.model }),
          ...(options.resumeSessionId && { resume: options.resumeSessionId }),
          ...(options.canUseTool && {
            canUseTool: async (toolName: string, input: unknown) => {
              const result = await options.canUseTool!(toolName, input);
              return result.behavior === "allow"
                ? { behavior: "allow" as const, updatedInput: result.updatedInput ?? input }
                : { behavior: "deny" as const, message: result.message };
            },
          }),
          tools: { type: "preset", preset: "claude_code" },
          systemPrompt: { type: "preset", preset: "claude_code" },
        },
      });

      for await (const message of agentQuery) {
        if (abortController.signal.aborted) break;

        const msgWithSession = message as { session_id?: string };
        if (typeof msgWithSession.session_id === "string") {
          options.onSdkSessionId?.(msgWithSession.session_id);
        }

        if (message.type === "assistant") {
          const content = message.message?.content;
          const textContent = Array.isArray(content)
            ? content
                .filter((block: { type: string }) => block.type === "text")
                .map((block: { text: string }) => block.text)
                .join("")
            : typeof content === "string"
              ? content
              : "";

          if (textContent) {
            options.onMessage({
              id: message.uuid || ulid(),
              role: "assistant",
              content: textContent,
              timestamp: Date.now(),
              sessionId,
            });
          }

          const toolUses = Array.isArray(content)
            ? content.filter((block: { type: string }) => block.type === "tool_use")
            : [];

          for (const toolUse of toolUses) {
            options.onMessage({
              id: (toolUse as { id?: string }).id || ulid(),
              role: "tool",
              content: `Using tool: ${(toolUse as { name: string }).name}`,
              toolName: (toolUse as { name: string }).name,
              toolInput: (toolUse as { input: unknown }).input,
              timestamp: Date.now(),
              sessionId,
            });
          }
        }

        if (message.type === "stream_event") {
          const delta = (message as { event?: { delta?: { type?: string; text?: string } } }).event
            ?.delta;
          if (delta?.type === "text_delta" && delta.text) {
            options.onMessage({
              id: message.uuid || ulid(),
              role: "assistant",
              content: delta.text,
              timestamp: Date.now(),
              isPartial: true,
              sessionId,
            });
          }
        }

        if (message.type === "result") {
          const resultMsg = message as {
            subtype: string;
            result?: string;
            total_cost_usd?: number;
            errors?: string[];
          };
          options.onResult({
            sessionId,
            success: resultMsg.subtype === "success",
            result: resultMsg.result,
            totalCostUsd: resultMsg.total_cost_usd,
            error: resultMsg.errors?.join(", "),
          });

          if (this.activeSession?.sessionId === sessionId) {
            this.activeSession.status = "idle";
          }
        }
      }
    } catch (error) {
      if (this.activeSession?.sessionId === sessionId) {
        this.activeSession.status = "error";
      }
      throw error;
    }
  }

  async stop(sessionId: string): Promise<void> {
    if (this.activeSession?.sessionId === sessionId) {
      this.activeSession.abortController.abort();
      this.activeSession.status = "stopped";
      this.activeSession = null;
    }
  }

  getStatus(): { status: AgentStatus; sessionId?: string } {
    if (!this.activeSession) {
      return { status: "idle" };
    }
    return {
      status: this.activeSession.status,
      sessionId: this.activeSession.sessionId,
    };
  }
}

export const agentManager = new AgentManager();

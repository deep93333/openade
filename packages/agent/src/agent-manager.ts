import type { AgentBackend, AgentBackendStartOptions } from "./types.js";
import type { AgentStatus } from "@agentide/shared";
import { ulid } from "ulid";
import { createAgentLogger, logAgentEvent, type AgentLogger, type AgentLogWriter } from "./logger.js";

export type AgentManagerOptions = {
  logger?: AgentLogger;
  writeAgentLog?: AgentLogWriter;
  backends: [AgentBackend["provider"], AgentBackend][];
};

function extractErrorDetail(error: unknown): string {
  if (!(error instanceof Error)) return String(error);
  const err = error as Error & {
    stderr?: string;
    stdout?: string;
    exit_code?: number;
    exitCode?: number;
    code?: string | number;
    signal?: string;
  };
  const message = err.message || "Unknown error";
  const parts: string[] = [message];
  if (err.stderr && !message.includes(err.stderr)) {
    parts.push(`stderr: ${err.stderr.trim()}`);
  }
  if (err.stdout) {
    parts.push(`stdout: ${err.stdout.trim()}`);
  }
  const exitCode = err.exit_code ?? err.exitCode ?? (typeof err.code === "number" ? err.code : undefined);
  if (exitCode !== undefined) parts.push(`exit code: ${exitCode}`);
  if (err.signal) parts.push(`signal: ${err.signal}`);
  return parts.join("\n\n");
}

type ActiveSession = {
  sessionId: string;
  abortController: AbortController;
  status: AgentStatus;
  backend: AgentBackend;
};

export function createAgentManager(options: AgentManagerOptions) {
  const logger = createAgentLogger(options.logger ?? options.writeAgentLog);
  const backends = new Map<AgentBackend["provider"], AgentBackend>(options.backends);

  function getBackend(provider: AgentBackend["provider"]): AgentBackend | null {
    return backends.get(provider) ?? null;
  }

  const sessions = new Map<string, ActiveSession>();

  type StartOptions = {
    prompt: string;
    existingMessages?: import("@agentide/shared").AgentMessage[];
    activeMemory?: string;
    workspaceId: string;
    workspacePath: string;
    provider?: AgentBackend["provider"];
    model?: string;
    mode?: import("@agentide/shared").AgentMode;
    resumeSessionId?: string;
    imageAttachments?: import("@agentide/shared").ImageAttachment[];
    mcpServers?: import("@agentide/shared").MCPServerConfig[];
    canUseTool?: AgentBackendStartOptions["canUseTool"];
    onMessage: AgentBackendStartOptions["onMessage"];
    onResult: AgentBackendStartOptions["onResult"];
    onError: AgentBackendStartOptions["onError"];
    onSdkSessionId?: (sdkSessionId: string) => void;
  };

  return {
    async start(options: StartOptions): Promise<string> {
      const provider: AgentBackend["provider"] = options.provider ?? "claude";
      logAgentEvent(logger, "DEBUG", "AgentManager", "start resolving backend", { provider });
      const backend = getBackend(provider);
      if (!backend) {
        logAgentEvent(logger, "ERROR", "AgentManager", "no_backend", { provider, available: [...backends.keys()] });
        throw new Error(`No agent backend for provider: ${provider}`);
      }

      const sessionId = ulid();
      const abortController = new AbortController();

      logAgentEvent(logger, "INFO", "AgentManager", "session_start", {
        sessionId,
        provider,
        model: options.model,
        workspacePath: options.workspacePath,
        hasExistingMessages: (options.existingMessages?.length ?? 0) > 0,
      });

      sessions.set(sessionId, {
        sessionId,
        abortController,
        status: "running",
        backend,
      });

      const backendOptions: AgentBackendStartOptions = {
        sessionId,
        workspacePath: options.workspacePath,
        prompt: options.prompt,
        existingMessages: options.existingMessages,
        activeMemory: options.activeMemory,
        model: options.model,
        mode: options.mode,
        resumeSessionId: options.resumeSessionId,
        imageAttachments: options.imageAttachments,
        mcpServers: options.mcpServers,
        abortSignal: abortController.signal,
        canUseTool: options.canUseTool,
        onMessage: options.onMessage,
        onResult: options.onResult,
        onError: options.onError,
        onProviderSessionId: (providerSessionId) => {
          options.onSdkSessionId?.(providerSessionId);
        },
      };

      backend.start(backendOptions).then(
        () => {
          const session = sessions.get(sessionId);
          if (session) session.status = "idle";
        },
        (error) => {
          const detail = extractErrorDetail(error);
          const err = error as Error & { stack?: string };
          logAgentEvent(logger, "ERROR", "AgentManager", "backend_start_rejected", {
            sessionId,
            detail,
            stack: err.stack?.slice(0, 1000),
          });
          options.onError({ sessionId, error: detail });
          const session = sessions.get(sessionId);
          if (session) session.status = "error";
        },
      );

      return sessionId;
    },

    async stop(sessionId: string): Promise<void> {
      const session = sessions.get(sessionId);
      if (session) {
        logAgentEvent(logger, "INFO", "AgentManager", "session_stop", { sessionId });
        session.abortController.abort();
        session.status = "stopped";
        sessions.delete(sessionId);
        await session.backend.stop(sessionId).catch((err) => {
          logAgentEvent(logger, "WARN", "AgentManager", "backend stop failed", {
            sessionId,
            error: err instanceof Error ? err.message : String(err),
          });
        });
      }
    },

    getStatus(): { status: AgentStatus; sessionId?: string; sessions?: Record<string, AgentStatus> } {
      if (sessions.size === 0) {
        return { status: "idle" };
      }
      const entries = [...sessions.entries()];
      const sessionMap = Object.fromEntries(entries.map(([id, s]) => [id, s.status]));
      const first = entries[0][1];
      return {
        status: first.status,
        sessionId: first.sessionId,
        sessions: sessionMap,
      };
    },

    getBackend,
    getCapabilities(provider: AgentBackend["provider"]) {
      const backend = backends.get(provider);
      return backend?.capabilities ?? null;
    },
    getModels(provider: AgentBackend["provider"]) {
      const backend = backends.get(provider);
      if (!backend) return [];
      return backend.models.filter((m) => m.provider === provider);
    },
    getAllModels(): { value: string; label: string; provider: AgentBackend["provider"] }[] {
      const result: { value: string; label: string; provider: AgentBackend["provider"] }[] = [];
      for (const [, backend] of backends) {
        for (const m of backend.models) {
          result.push({ value: m.value, label: m.label, provider: m.provider });
        }
      }
      const seen = new Set<string>();
      return result.filter((m) => {
        const key = `${m.provider}:${m.value}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    },
  };
}

export type AgentManager = ReturnType<typeof createAgentManager>;

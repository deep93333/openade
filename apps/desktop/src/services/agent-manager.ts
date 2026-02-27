import type { AgentBackend, AgentBackendStartOptions } from "./agent-backend-types";
import type { AgentStatus } from "@agentide/shared";
import { ulid } from "ulid";
import { customAgentBackend } from "./custom-agent-backend";
import { getAgentLogPath, writeAgentLog } from "./agent-log";

export { getAgentLogPath };

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

const BACKENDS = new Map<AgentBackend["provider"], AgentBackend>([
  ["claude", customAgentBackend],
  ["codex", customAgentBackend],
]);


export function getBackend(provider: AgentBackend["provider"]): AgentBackend | null {
  return BACKENDS.get(provider) ?? null;
}

export function getCapabilities(provider: AgentBackend["provider"]) {
  const backend = BACKENDS.get(provider);
  return backend?.capabilities ?? null;
}

export function getModels(provider: AgentBackend["provider"]) {
  const backend = BACKENDS.get(provider);
  if (!backend) return [];
  return backend.models.filter((m) => m.provider === provider);
}

export function getAllModels(): { value: string; label: string; provider: AgentBackend["provider"] }[] {
  const result: { value: string; label: string; provider: AgentBackend["provider"] }[] = [];
  for (const [, backend] of BACKENDS) {
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
}

type AgentStartOptions = {
  prompt: string;
  existingMessages?: import("@agentide/shared").AgentMessage[];
  workspaceId: string;
  workspacePath: string;
  provider?: AgentBackend["provider"];
  model?: string;
  mode?: import("@agentide/shared").AgentMode;
  resumeSessionId?: string;
  imageAttachments?: import("@agentide/shared").ImageAttachment[];
  canUseTool?: AgentBackendStartOptions["canUseTool"];
  onMessage: AgentBackendStartOptions["onMessage"];
  onResult: AgentBackendStartOptions["onResult"];
  onError: AgentBackendStartOptions["onError"];
  onSdkSessionId?: (sdkSessionId: string) => void;
};

class AgentManager {
  private sessions = new Map<string, ActiveSession>();

  async start(options: AgentStartOptions): Promise<string> {
    const provider: AgentBackend["provider"] = options.provider ?? "claude";
    const backend = getBackend(provider);
    if (!backend) {
      throw new Error(`No agent backend for provider: ${provider}`);
    }

    const sessionId = ulid();
    const abortController = new AbortController();

    writeAgentLog("INFO", "Agent", "session start", {
      sessionId,
      provider,
      model: options.model,
      workspacePath: options.workspacePath,
      hasExistingMessages: (options.existingMessages?.length ?? 0) > 0,
    });

    this.sessions.set(sessionId, {
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
      model: options.model,
      mode: options.mode,
      resumeSessionId: options.resumeSessionId,
      imageAttachments: options.imageAttachments,
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
        const session = this.sessions.get(sessionId);
        if (session) session.status = "idle";
      },
      (error) => {
        const detail = extractErrorDetail(error);
        writeAgentLog("ERROR", "Agent", "backend.start rejected", { sessionId, detail });
        options.onError({ sessionId, error: detail });
        const session = this.sessions.get(sessionId);
        if (session) session.status = "error";
      }
    );

    return sessionId;
  }

  async stop(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) {
      writeAgentLog("INFO", "Agent", "agent_event", { event: "session_stop", sessionId });
      session.abortController.abort();
      session.status = "stopped";
      this.sessions.delete(sessionId);
      await session.backend.stop(sessionId).catch(() => {});
    }
  }

  getStatus(): { status: AgentStatus; sessionId?: string; sessions?: Record<string, AgentStatus> } {
    if (this.sessions.size === 0) {
      return { status: "idle" };
    }
    const entries = [...this.sessions.entries()];
    const sessions = Object.fromEntries(entries.map(([id, s]) => [id, s.status]));
    const first = entries[0][1];
    return {
      status: first.status,
      sessionId: first.sessionId,
      sessions,
    };
  }
}

export const agentManager = new AgentManager();

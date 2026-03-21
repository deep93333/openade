import { getBackendBaseUrl } from "@/lib/backend-url";
import { getElectronAPI } from "@/lib/electron";
import type {
  AgentBridgeApi,
  AgentErrorPayload,
  AgentMessage,
  AgentModelOption,
  AgentResult,
  AgentStartParams,
  AgentStatus,
  CommitMessageParams,
  IpcResult,
  SdkSessionIdPayload,
  ThreadTitleParams,
  ToolApprovalRequest,
  ToolApprovalResponse,
} from "@agentide/shared";

function toWsUrl(httpBase: string): string {
  const u = new URL(httpBase);
  u.protocol = u.protocol === "https:" ? "wss:" : "ws:";
  return `${u.origin}/api/agent/ws`;
}

type SecretsPayload = Partial<{
  anthropic: string | null;
  codex: string | null;
  minimax: string | null;
  moonshot: string | null;
  moonshotBaseUrl: string | null;
}>;

async function collectSecretsForServer(): Promise<SecretsPayload> {
  const api = getElectronAPI();
  if (!api?.apiKeys) return {};
  const [claude, codex, minimax, moonshot, settings] = await Promise.all([
    api.apiKeys.get("claude"),
    api.apiKeys.get("codex"),
    api.apiKeys.get("minimax"),
    api.apiKeys.get("moonshot"),
    api.settings?.get?.(),
  ]);
  const moonshotBaseUrl =
    settings?.success && settings.data?.moonshotBaseUrl ? settings.data.moonshotBaseUrl : null;
  return {
    anthropic: claude.success ? claude.data : null,
    codex: codex.success ? codex.data : null,
    minimax: minimax.success ? minimax.data : null,
    moonshot: moonshot.success ? moonshot.data : null,
    moonshotBaseUrl,
  };
}

function sanitizeStartParams(params: AgentStartParams): AgentStartParams {
  const imageAttachments = params.imageAttachments?.map(({ file: _f, ...rest }) => rest);
  return { ...params, ...(imageAttachments !== undefined && { imageAttachments }) };
}

function createHttpAgentBridge(baseUrl: string): AgentBridgeApi {
  const messageHandlers = new Set<(m: AgentMessage) => void>();
  const resultHandlers = new Set<(r: AgentResult) => void>();
  const errorHandlers = new Set<(e: AgentErrorPayload) => void>();
  const sdkHandlers = new Set<(p: SdkSessionIdPayload) => void>();
  const toolApprovalHandlers = new Set<(r: ToolApprovalRequest) => void>();

  let ws: WebSocket | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  const wsUrl = toWsUrl(baseUrl);

  function dispatchWs(raw: string) {
    let parsed: { type?: string; payload?: unknown };
    try {
      parsed = JSON.parse(raw) as { type?: string; payload?: unknown };
    } catch {
      return;
    }
    const { type, payload } = parsed;
    if (type === "message" && payload) {
      for (const h of messageHandlers) h(payload as AgentMessage);
    } else if (type === "result" && payload) {
      for (const h of resultHandlers) h(payload as AgentResult);
    } else if (type === "error" && payload) {
      for (const h of errorHandlers) h(payload as AgentErrorPayload);
    } else if (type === "sdk_session_id" && payload) {
      for (const h of sdkHandlers) h(payload as SdkSessionIdPayload);
    } else if (type === "tool_approval_request" && payload) {
      for (const h of toolApprovalHandlers) h(payload as ToolApprovalRequest);
    }
  }

  function connectWs() {
    if (ws?.readyState === WebSocket.OPEN || ws?.readyState === WebSocket.CONNECTING) return;
    try {
      ws = new WebSocket(wsUrl);
    } catch {
      scheduleReconnect();
      return;
    }
    ws.onmessage = (ev) => {
      if (typeof ev.data === "string") dispatchWs(ev.data);
    };
    ws.onclose = () => {
      ws = null;
      scheduleReconnect();
    };
    ws.onerror = () => {
      ws?.close();
    };
  }

  function scheduleReconnect() {
    if (reconnectTimer) return;
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      connectWs();
    }, 1500);
  }

  function ensureWs() {
    connectWs();
  }

  async function postJson<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(`${baseUrl}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return res.json() as Promise<T>;
  }

  return {
    start: async (params) => {
      ensureWs();
      const secrets = await collectSecretsForServer();
      return postJson<IpcResult<{ sessionId: string }>>("/api/agent/start", {
        params: sanitizeStartParams(params),
        secrets,
      });
    },

    stop: (sessionId) => postJson<IpcResult>("/api/agent/stop", { sessionId }),

    status: () =>
      fetch(`${baseUrl}/api/agent/status`).then(
        (r) => r.json() as Promise<IpcResult<{ status: AgentStatus; sessionId?: string }>>
      ),

    getModels: () =>
      fetch(`${baseUrl}/api/agent/models`).then(
        (r) => r.json() as Promise<IpcResult<AgentModelOption[]>>
      ),

    generateThreadTitle: async (params) => {
      const secrets = await collectSecretsForServer();
      return postJson<IpcResult<string | null>>("/api/agent/generate-thread-title", {
        params,
        secrets,
      });
    },

    generateCommitMessage: async (params) => {
      const secrets = await collectSecretsForServer();
      return postJson<IpcResult<string | null>>("/api/agent/generate-commit-message", {
        params,
        secrets,
      });
    },

    onMessage: (cb) => {
      ensureWs();
      messageHandlers.add(cb);
      return () => messageHandlers.delete(cb);
    },

    onResult: (cb) => {
      ensureWs();
      resultHandlers.add(cb);
      return () => resultHandlers.delete(cb);
    },

    onError: (cb) => {
      ensureWs();
      errorHandlers.add(cb);
      return () => errorHandlers.delete(cb);
    },

    onSdkSessionId: (cb) => {
      ensureWs();
      sdkHandlers.add(cb);
      return () => sdkHandlers.delete(cb);
    },

    onToolApprovalRequest: (cb) => {
      ensureWs();
      toolApprovalHandlers.add(cb);
      return () => toolApprovalHandlers.delete(cb);
    },

    respondToolApproval: async (response: ToolApprovalResponse) => {
      await postJson<{ ok?: boolean }>("/api/agent/tool-approval", response);
    },
  };
}

let cached: AgentBridgeApi | null = null;

export function getAgentBridge(): AgentBridgeApi {
  if (!cached) {
    cached = createHttpAgentBridge(getBackendBaseUrl());
  }
  return cached;
}

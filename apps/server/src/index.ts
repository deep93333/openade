import { AsyncLocalStorage } from "node:async_hooks";
import {
  type AgentBackendConfig,
  type ToolApprovalResult,
  createAgentManager,
  createCustomAgentBackend,
  generateCommitMessage as generateCommitMessageForBackend,
  generateThreadTitle as generateThreadTitleForBackend,
  refreshModelPricing,
} from "@openade/agent";
import type {
  AgentMessage,
  AgentStartParams,
  CommitMessageParams,
  ThreadTitleParams,
  ToolApprovalResponse,
} from "@openade/shared";
import { Hono } from "hono";
import { upgradeWebSocket, websocket } from "hono/bun";
import { cors } from "hono/cors";
import type { WSContext } from "hono/ws";
import { ulid } from "ulid";
import { invokeIpc } from "./platform/ipc-invoke.js";
import { setWorkspaceWatchBroadcast, syncWorkspaceWatchers } from "./platform/workspace-watchers.js";

type SessionSecrets = {
  anthropic: string | null;
  codex: string | null;
  minimax: string | null;
  moonshot: string | null;
  moonshotBaseUrl: string | null;
};

type SecretsPayload = Partial<{
  anthropic: string | null;
  codex: string | null;
  minimax: string | null;
  moonshot: string | null;
  moonshotBaseUrl: string | null;
}>;

const sessionSecrets = new AsyncLocalStorage<SessionSecrets>();

function mergeSecrets(body?: SecretsPayload): SessionSecrets {
  return {
    anthropic:
      body?.anthropic ?? process.env.ANTHROPIC_API_KEY ?? process.env.CLAUDE_API_KEY ?? null,
    codex: body?.codex ?? process.env.OPENAI_API_KEY ?? null,
    minimax: body?.minimax ?? process.env.MINIMAX_API_KEY ?? null,
    moonshot: body?.moonshot ?? process.env.MOONSHOT_API_KEY ?? null,
    moonshotBaseUrl: body?.moonshotBaseUrl ?? process.env.MOONSHOT_BASE_URL ?? null,
  };
}

const serverLogger: AgentBackendConfig["logger"] = {
  log({ level, source, args }) {
    const line = `[${level}] [${source}] ${args.map((a) => (typeof a === "string" ? a : JSON.stringify(a))).join(" ")}`;
    if (level === "ERROR") console.error(line);
    else if (level === "WARN") console.warn(line);
    else console.log(line);
  },
};

const backendConfig: AgentBackendConfig = {
  getApiKey: () => sessionSecrets.getStore()?.anthropic ?? null,
  getCodexApiKey: () => sessionSecrets.getStore()?.codex ?? null,
  getMinimaxApiKey: () => sessionSecrets.getStore()?.minimax ?? null,
  getMoonshotApiKey: () => sessionSecrets.getStore()?.moonshot ?? null,
  getMoonshotBaseUrl: () => sessionSecrets.getStore()?.moonshotBaseUrl ?? null,
  logger: serverLogger,
};

const backend = createCustomAgentBackend(backendConfig);

const agentManager = createAgentManager({
  logger: serverLogger,
  backends: [
    ["claude", backend],
    ["codex", backend],
    ["minimax", backend],
    ["moonshot", backend],
  ],
});

const wsClients = new Set<WSContext>();
const platformWsClients = new Set<WSContext>();

function broadcastWorkspaceIpc(channel: string, payload: { workspaceId: string }) {
  const raw = JSON.stringify({ type: "workspace_ipc", channel, payload });
  for (const ws of platformWsClients) {
    try {
      if (ws.readyState === 1) ws.send(raw);
      else platformWsClients.delete(ws);
    } catch {
      platformWsClients.delete(ws);
    }
  }
}

setWorkspaceWatchBroadcast(broadcastWorkspaceIpc);
syncWorkspaceWatchers();

function broadcastJson(payload: unknown) {
  const raw = JSON.stringify(payload);
  for (const ws of wsClients) {
    try {
      if (ws.readyState === 1) ws.send(raw);
    } catch {
      wsClients.delete(ws);
    }
  }
}

type PendingApproval = {
  resolve: (r: ToolApprovalResult) => void;
  input: unknown;
};

const pendingToolApprovals = new Map<string, PendingApproval>();

const app = new Hono();

app.use(
  "*",
  cors({
    origin: [
      "http://127.0.0.1:3010",
      "http://localhost:3010",
      "http://127.0.0.1:5173",
      "http://localhost:5173",
    ],
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["Content-Type"],
  })
);

app.get("/api/health", (c) => c.json({ ok: true }));

app.post("/api/platform/ipc", async (c) => {
  const body = (await c.req.json()) as { channel: string; args?: unknown[] };
  const result = await invokeIpc(body.channel, body.args ?? []);
  return c.json(result);
});

app.get(
  "/api/platform/ws",
  upgradeWebSocket(() => ({
    onOpen(_evt, ws) {
      platformWsClients.add(ws);
    },
    onClose(_evt, ws) {
      platformWsClients.delete(ws);
    },
  }))
);

app.get(
  "/api/agent/ws",
  upgradeWebSocket((c) => ({
    onOpen(_evt, ws) {
      wsClients.add(ws);
    },
    onClose(_evt, ws) {
      wsClients.delete(ws);
    },
  }))
);

app.post("/api/agent/start", async (c) => {
  try {
    const body = (await c.req.json()) as {
      params: AgentStartParams;
      secrets?: SecretsPayload;
    };
    const params = body.params;
    const workspacePath = params.workspacePath?.trim();
    if (!workspacePath) {
      return c.json({ success: false, error: "workspacePath is required" }, 400);
    }

    const secrets = mergeSecrets(body.secrets);
    const ALWAYS_APPROVE_BYPASS = new Set(["ask_question"]);
    const TOOL_APPROVAL_TIMEOUT_MS = 5 * 60 * 1000;

    const sessionId = await sessionSecrets.run(secrets, async () => {
      const canUseTool = async (
        sid: string,
        toolName: string,
        input: unknown
      ): Promise<ToolApprovalResult> => {
        if (!params.requireApproval && !ALWAYS_APPROVE_BYPASS.has(toolName)) {
          return { behavior: "allow", updatedInput: input };
        }
        const requestId = ulid();
        return new Promise<ToolApprovalResult>((resolve) => {
          const timeout = setTimeout(() => {
            if (pendingToolApprovals.delete(requestId)) {
              resolve({
                behavior: "deny",
                message:
                  "Tool approval timed out. Disable 'Require approval' in Settings to run without waiting.",
              });
            }
          }, TOOL_APPROVAL_TIMEOUT_MS);
          pendingToolApprovals.set(requestId, {
            resolve: (r) => {
              clearTimeout(timeout);
              resolve(r);
            },
            input,
          });
          broadcastJson({
            type: "tool_approval_request",
            payload: {
              requestId,
              toolName,
              input,
              sessionId: sid,
              workspaceId: params.workspaceId,
            },
          });
        });
      };

      return agentManager.start({
        prompt: params.prompt,
        existingMessages: params.existingMessages,
        activeMemory: params.activeMemory,
        workspaceId: params.workspaceId,
        workspacePath,
        provider: params.provider ?? "claude",
        model: params.model,
        mode: params.mode,
        resumeSessionId: params.resumeSessionId,
        imageAttachments: params.imageAttachments,
        mcpServers: params.mcpServers,
        canUseTool,
        onMessage: (message: AgentMessage) => {
          broadcastJson({ type: "message", payload: message });
        },
        onResult: (result) => {
          broadcastJson({ type: "result", payload: result });
        },
        onError: (payload) => {
          broadcastJson({
            type: "error",
            payload: {
              ...payload,
              workspaceId: params.workspaceId,
            },
          });
        },
        onSdkSessionId: (sdkSessionId: string) => {
          broadcastJson({
            type: "sdk_session_id",
            payload: {
              sdkSessionId,
              threadId: params.activeThreadId ?? "",
              workspaceId: params.workspaceId,
              provider: params.provider ?? "claude",
            },
          });
        },
      });
    });

    return c.json({ success: true, data: { sessionId } });
  } catch (e) {
    return c.json(
      {
        success: false,
        error: e instanceof Error ? e.message : "Failed to start agent",
      },
      500
    );
  }
});

app.post("/api/agent/stop", async (c) => {
  try {
    const { sessionId } = (await c.req.json()) as { sessionId: string };
    if (!sessionId) return c.json({ success: false, error: "sessionId required" }, 400);
    await agentManager.stop(sessionId);
    return c.json({ success: true });
  } catch (e) {
    return c.json(
      {
        success: false,
        error: e instanceof Error ? e.message : "Failed to stop agent",
      },
      500
    );
  }
});

app.get("/api/agent/status", (c) => {
  const status = agentManager.getStatus();
  return c.json({ success: true, data: status });
});

app.get("/api/agent/models", async (c) => {
  try {
    await refreshModelPricing().catch(() => {});
    const models = agentManager.getAllModels();
    return c.json({ success: true, data: models });
  } catch (e) {
    return c.json(
      {
        success: false,
        error: e instanceof Error ? e.message : "Failed to get models",
      },
      500
    );
  }
});

app.post("/api/agent/generate-thread-title", async (c) => {
  try {
    const body = (await c.req.json()) as {
      params: ThreadTitleParams;
      secrets?: SecretsPayload;
    };
    const secrets = mergeSecrets(body.secrets);
    const title = await sessionSecrets.run(secrets, () =>
      generateThreadTitleForBackend(backendConfig, body.params)
    );
    return c.json({ success: true, data: title });
  } catch (e) {
    return c.json(
      {
        success: false,
        error: e instanceof Error ? e.message : "Failed to generate title",
      },
      500
    );
  }
});

app.post("/api/agent/generate-commit-message", async (c) => {
  try {
    const body = (await c.req.json()) as {
      params: CommitMessageParams;
      secrets?: SecretsPayload;
    };
    const secrets = mergeSecrets(body.secrets);
    const message = await sessionSecrets.run(secrets, () =>
      generateCommitMessageForBackend(backendConfig, body.params)
    );
    return c.json({ success: true, data: message });
  } catch (e) {
    return c.json(
      {
        success: false,
        error: e instanceof Error ? e.message : "Failed to generate commit message",
      },
      500
    );
  }
});

app.post("/api/agent/tool-approval", async (c) => {
  const response = (await c.req.json()) as ToolApprovalResponse;
  const pending = pendingToolApprovals.get(response.requestId);
  if (!pending) return c.json({ ok: true });
  pendingToolApprovals.delete(response.requestId);
  if (response.allow) {
    pending.resolve({
      behavior: "allow",
      updatedInput: response.updatedInput ?? pending.input,
    });
  } else {
    pending.resolve({
      behavior: "deny",
      message: response.message ?? "Denied",
    });
  }
  return c.json({ ok: true });
});

const port = Number(process.env.AGENT_SERVER_PORT ?? process.env.PORT ?? 42891);
const hostname = "127.0.0.1";

console.log(`[openade/server] listening on http://${hostname}:${port}`);

export default {
  port,
  hostname,
  fetch: app.fetch,
  websocket,
};

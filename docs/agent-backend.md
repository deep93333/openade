# Agent Backend Abstraction

Single abstraction for running **any** auto-agent (Claude, Codex, or a future provider) from AgentIDE. The app and IPC stay provider-agnostic; only the desktop backend implements or delegates to each provider.

**Types:** `apps/desktop/src/services/agent-backend-types.ts` (`AgentBackend`, `AgentBackendStartOptions`, `ProviderCapabilities`, `ModelOption`, `ToolApprovalResult`). Shared: `AgentProvider`, `AgentStartParams` in `packages/shared/src/types.ts`.

---

## 1. Contract (provider-agnostic)

### 1.1 What the app and IPC see

- **Start:** `AgentStartParams` (prompt, workspaceId, model, mode, **provider**, requireApproval, **resumeSessionId**, imageAttachments).
- **Stop:** `sessionId` (our internal id).
- **Events:** `AgentMessage`, `AgentResult`, `AgentErrorPayload`, `SdkSessionIdPayload`, `ToolApprovalRequest` / `ToolApprovalResponse`.

The app does **not** know which provider is running. It passes `provider` and `resumeSessionId`; the backend picks the right implementation.

### 1.2 Backend interface (desktop)

```ts
type AgentBackendStartOptions = {
  sessionId: string;
  workspacePath: string;
  prompt: string;
  model?: string;
  mode?: AgentMode;
  resumeSessionId?: string;
  imageAttachments?: ImageAttachment[];
  abortSignal: AbortSignal;
  canUseTool?: (sessionId: string, toolName: string, input: unknown) => Promise<ToolApprovalResult>;
  onMessage: (message: AgentMessage) => void;
  onResult: (result: AgentResult) => void;
  onError: (payload: { sessionId: string; error: string }) => void;
  onProviderSessionId: (providerSessionId: string) => void;
};

type AgentBackend = {
  readonly provider: AgentProvider;
  readonly capabilities: ProviderCapabilities;
  readonly models: ModelOption[];
  start(options: AgentBackendStartOptions): Promise<void>;
  stop(sessionId: string): Promise<void>;
};
```

### 1.3 Provider capabilities

Each backend declares what it supports. The UI uses this to show/hide features.

```ts
type ProviderCapabilities = {
  supportedModes: AgentMode[];       // e.g. Claude: ["ask","plan","agent"]; Codex: ["agent"]
  supportsToolApproval: boolean;     // Claude: true (canUseTool); Codex: coarse (sandbox/policy)
  supportsImageAttachments: boolean; // Claude: true; Codex: check SDK
  supportsResume: boolean;           // both support resume
};
```

**Why this matters:** Claude has fine-grained tool approval (`canUseTool` per tool call) and three modes. Codex has approval policies (`on-request`, `never`) and sandbox modes — a coarser model. A future local agent might have no approval at all. The UI queries `capabilities` to:

- Show only supported modes in the mode selector.
- Show/hide the approval toggle.
- Show/hide the image attach button.
- Warn when resuming across providers isn't possible.

### 1.4 Model list

Each backend exposes its `models: ModelOption[]`. The router aggregates them or the UI filters by selected provider:

```ts
type ModelOption = {
  value: string;    // e.g. "claude-sonnet-4-6", "gpt-5.1-codex"
  label: string;
  provider: AgentProvider;
};
```

No more hardcoded `MODEL_OPTIONS` in `agent-panel.tsx`.

---

## 2. Normalized event shape

All providers must emit the **same** event shapes so the app stays unchanged.

| Event | Shape | When |
|-------|-------|------|
| Message | `AgentMessage` (role, content, toolName?, toolInput?, isPartial?, sessionId) | Streaming text or tool use. |
| Result | `AgentResult` (sessionId, success, result?, error?, totalCostUsd?) | Run finished. |
| Error | `{ sessionId, error: string }` | Fatal error. |
| Provider session id | via `onProviderSessionId(id)` | First event with provider's session/thread id; app stores for resume. |
| Tool approval | `canUseTool` callback (if provider supports it); backend asks, app responds. | Before a tool executes. |

---

## 3. Resume and provider switching

- **Our sessionId:** Opaque ulid for one run; event correlation + stop.
- **Provider session id (sdkSessionId):** Provider-specific (Claude session_id, Codex threadId). Stored per thread in `ChatThread.sdkSessionId`. Thread also stores `ChatThread.provider` so we know which provider created that session.
- **Resume on same provider:** App sends `resumeSessionId: thread.sdkSessionId`. Backend uses it (Claude: `options.resume`, Codex: `resumeThread(id)`).
- **Resume after provider switch:** If `thread.provider !== params.provider`, the backend **ignores** `resumeSessionId` and starts a fresh session. It emits a new `providerSessionId`; the app updates `thread.sdkSessionId` and `thread.provider`. Previous messages stay in the thread for context display but the provider starts clean.

---

## 4. Auth (provider-specific)

| Provider | Auth methods | Where |
|----------|-------------|-------|
| Claude | `api_key` (ANTHROPIC_API_KEY), `claude_login` (CLI session) | `config-storage.ts`, env |
| Codex | `codex_api_key` (CODEX_API_KEY / OPENAI_API_KEY), `codex_login` (ChatGPT session) | `config-storage.ts`, env |
| Future | Extend `AuthMethod` in shared types; handle in config-storage and backend | — |

The backend is responsible for reading its own auth (from config-storage or env). The router does not handle auth — but the UI may need to show a provider-specific auth dialog (e.g. "Enter Codex API key" vs "Enter Anthropic API key"). The `ApiKeyDialog` should become provider-aware (or show per-provider sections).

Shared type `AuthMethod` now includes `"codex_api_key" | "codex_login"`.

---

## 5. Mode mapping per provider

| Mode | Claude | Codex |
|------|--------|-------|
| `agent` | Full tools + claude_code preset | Default: full access; sandbox `workspace-write` |
| `plan` | Read-only tools (Read, Glob, Grep, LS) + planning system prompt | Not natively supported; backend can restrict or ignore |
| `ask` | No tools + answer-only system prompt | Not natively supported; backend can ignore tools |

The backend's `capabilities.supportedModes` tells the UI which modes to offer. If the user picks a mode the provider doesn't support, the backend either maps it to the closest equivalent or rejects with a clear error.

---

## 6. Claude backend

- **Package:** `@anthropic-ai/claude-agent-sdk`, `query({ prompt, options })`.
- **Resume:** `options.resume` = sdkSessionId.
- **Working directory:** `options.cwd`.
- **Tool approval:** `options.canUseTool` → async (toolName, input) → allow/deny.
- **Streaming:** Iterate messages → `onMessage` (text, tool_use, partial); `onResult`; `onProviderSessionId(session_id)`.
- **Stop:** `abortController.abort()`.
- **Modes:** Map `ask`/`plan`/`agent` to tools/systemPrompt (current logic in `agent-manager.ts`).
- **Models:** Claude model list (sonnet, opus, haiku variants).

See `docs/claude-agent-sdk-guide.md`.

---

## 7. Codex backend

- **Package:** `@openai/codex-sdk` (or MCP: `codex mcp-server`).
- **Resume:** `codex.resumeThread(sdkSessionId)`.
- **Working directory:** `startThread({ workingDirectory })`.
- **Tool approval:** Codex uses `approval_policy` (on-request, never) and `sandbox` modes. When `approval_policy: "on-request"`, Codex pauses for approval — backend maps this to `canUseTool` if present, otherwise auto-approves. When `canUseTool` is absent, use `approval_policy: "never"` + `sandbox: "workspace-write"`.
- **Streaming:** `thread.runStreamed()` → map events to `onMessage` / `onResult` / `onProviderSessionId(threadId)`.
- **Stop:** Abort or cancel the thread.
- **Modes:** Only `agent` is natively supported. `ask` and `plan` can be approximated by restricting the system prompt (no writes), but declare `capabilities.supportedModes: ["agent"]` initially.
- **Models:** Codex model list (e.g. `gpt-5.1-codex`, `o4-mini`).

See `docs/codex-agent-guide.md`.

---

## 8. Adding a new provider

1. Extend `AgentProvider` in `packages/shared/src/types.ts`.
2. Add auth methods to `AuthMethod` if needed.
3. Implement `AgentBackend` in `apps/desktop/src/services/<provider>-agent-backend.ts`:
   - Set `capabilities` (modes, approval, images, resume).
   - Set `models`.
   - Implement `start()`: run the provider, map events to `onMessage`/`onResult`/`onError`/`onProviderSessionId`, use `canUseTool` if supported.
   - Implement `stop()`.
4. Register in the router (`agent-manager.ts`).
5. No IPC, preload, or app-store changes needed.

---

## 9. Router (agent-manager.ts)

The router is the only place that knows about multiple backends:

1. Holds a `Map<AgentProvider, AgentBackend>` (or a record).
2. On `start(params)`:
   - Resolve `provider` from `params.provider ?? "claude"`.
   - Get backend from map.
   - Generate `sessionId` (ulid), create `AbortController`.
   - Check if `resumeSessionId` is valid for this provider (compare `thread.provider` vs `provider`; if mismatch, clear `resumeSessionId`).
   - Call `backend.start({ sessionId, workspacePath, prompt, model, mode, resumeSessionId, imageAttachments, abortSignal, canUseTool, onMessage, onResult, onError, onProviderSessionId })`.
3. On `stop(sessionId)`: abort + call `backend.stop(sessionId)`.
4. Exposes `getModels()` → aggregated `ModelOption[]` from all backends, `getCapabilities(provider)` → `ProviderCapabilities`.

---

## 10. File layout

| What | Where |
|------|-------|
| Shared types | `packages/shared/src/types.ts` (`AgentProvider`, `AgentStartParams`, `AuthMethod`, `ChatThread.provider`, events) |
| Backend contract | `apps/desktop/src/services/agent-backend-types.ts` (`AgentBackend`, `ProviderCapabilities`, `ModelOption`, etc.) |
| Router | `apps/desktop/src/services/agent-manager.ts` |
| Claude backend | `apps/desktop/src/services/claude-agent-backend.ts` (extract from current agent-manager) |
| Codex backend | `apps/desktop/src/services/codex-agent-backend.ts` (new) |
| IPC / app | No change to IPC; app queries capabilities/models from router via new IPC if needed |
| Docs | `docs/agent-backend.md` (this file) |

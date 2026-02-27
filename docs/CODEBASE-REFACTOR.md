# AgentIDE Codebase: Documentation, Abstractions & Refactoring

This doc covers: **features that don't work well or are under-documented**, **where abstraction is needed**, **what to refactor**, and **where best practices aren't followed**. Use it as a single reference for technical debt and next steps.

**How to correct the foundation:** See **[docs/foundation.md](foundation.md)** for a step-by-step plan. Summary: fix the **contract** (shared types + preload) first, then **core abstractions** (agent backend, prompt builder), then features and polish.

---

## 1. Features that don't work well / under-documented

### 1.1 File and code mentions not sent to the agent

**Current behavior:** The chat editor supports `@file` and "Add to chat" (code selection) mentions. Only the **label** (e.g. `@src/App.tsx` or `App.tsx:10-20`) is sent to the agent; file contents and code snippets are never injected.

**Where it lives:**

- **Editor:** `apps/app/src/components/agent/chat-editor/` (TipTap Mention; file list from `useWorkspaceFiles`; code selection from `file-viewer-drawer.tsx` → `addContextToChat`).
- **Prompt build:** `agent-panel.tsx` uses `editorRef.current.getText()` (and optional skill hint); no walk of mention nodes or content resolution.
- **Normalization:** `normalize-user-message.ts` only flattens mentions to `@label` for **display**; it is not used to build the agent prompt.

**Gap:** There is no "prompt augmentation" step that resolves mentions (file path → read file; code mention `id` → JSON `{ filePath, code, startLine, endLine }`) and appends that context to the prompt before `api.agent.start()`.

**Recommendation:** Document this as a known limitation; add a small "prompt builder" that walks editor JSON, resolves mentions (using existing `filesystem.readFile` IPC for file mentions), and produces the final prompt string. Optionally support a short "comment" on code mentions.

---

### 1.2 "Open in Cursor" / external editor

**Current behavior:** Not implemented. File viewer and file tree are read-only with no "Open in Cursor" or "Open in VS Code".

**Recommendation:** Add an action that runs `cursor <path>:<line>` or `code --goto <path>:<line>` (or equivalent) via `shell.openExternal` or a small Node helper; optionally only show when the CLI is on PATH. Document the intended behavior (open file, optional line) in a short "Editor integration" section.

---

### 1.3 Git: Push and API naming

**Current behavior:** `WORKSPACE_GIT_PUSH` exists in IPC and is exposed on `workspace.push(workspaceId)`. There is no prominent "Push" control in the UI (e.g. in sidebar or git panel); branch switcher may be the only entry point.

**Recommendation:** Add a visible "Push" (or "Sync") control that calls `api.workspace.push(workspaceId)` and document where commit/push live in the UI.

**API naming inconsistency:** `packages/shared/src/electron-api.ts` uses `getStagedChanges` / `getUnstagedChanges`. The app uses `api.workspace.getUnstagedChanges` and, in `git-changes-panel.tsx`, a **cast** to call `getStagedChanges` with a custom return type. That suggests the shared `ElectronAPI` type and actual usage (or preload) are out of sync.

**Location:** `apps/app/src/components/git-changes-panel.tsx` (e.g. around 137):

```ts
const getStaged = (api.workspace as { getStagedChanges?: (id: string) => Promise<...> }).getStagedChanges;
```

**Recommendation:** Align `ElectronAPI.workspace` with the real return types (`IpcResult<GitStagedChange[]>` etc.) so no cast is needed; document the workspace API in one place (e.g. `docs/electron-api.md`).

---

### 1.4 Preload vs shared contract

**Current behavior:** `apps/desktop/src/preload.ts` exposes the front-end API. Some signatures don't match `packages/shared/src/electron-api.ts`:

- **chat.save:** Preload uses `data: { messages: unknown[] }`; shared type is `ChatData` (`threads`, `activeThreadId`). IPC main correctly expects `ChatData`; preload's param type is wrong and can hide bugs.
- **agent.start:** Preload types params as `{ prompt: string; workspaceId: string }`; shared `AgentStartParams` includes `activeThreadId`, `model`, `mode`, `requireApproval`, `resumeSessionId`, `imageAttachments`. So the full contract is not reflected in preload.

**Recommendation:** Use shared types in preload (e.g. `AgentStartParams`, `ChatData`) so the process boundary is a single source of truth. Document that preload must stay in sync with `ElectronAPI` and `IPC` in `packages/shared`.

---

### 1.5 ChatData and sdkSessionId type drift

**Current behavior:** `packages/shared/src/types.ts` defines `ChatData` as `{ threads, activeThreadId }` only. Desktop `chat-storage.ts` and IPC also use a top-level `sdkSessionId` (read/write in `getChat`/`setChat` and in IPC when passing session id).

**Recommendation:** Either extend shared `ChatData` with `sdkSessionId?: string` or introduce a separate "persisted chat" type used only by desktop and keep `ChatData` as the app-facing shape. Document which type is persisted and which is in-memory/API.

---

### 1.6 Duplicate ChatEditor entry points

**Current behavior:** Two entry points exist:

- `apps/app/src/components/agent/chat-editor.tsx` (standalone file)
- `apps/app/src/components/agent/chat-editor/chat-editor.tsx` (with `index.ts` and `types.ts`)

`agent-panel.tsx` imports from `"./chat-editor"`; resolution goes to the **directory** `chat-editor/index.ts`, which re-exports from `chat-editor/chat-editor.tsx`. The root `chat-editor.tsx` appears unused or legacy.

**Recommendation:** Confirm the root `chat-editor.tsx` is unused; if so, remove it and document that the single ChatEditor lives under `agent/chat-editor/`. If both are used in different flows, document when each is used and consider unifying.

---

## 2. Where abstraction is needed

### 2.1 Agent backend (Claude vs Codex)

**Current state:** `apps/desktop/src/services/agent-manager.ts` is Claude-only. It imports `query` from `@anthropic-ai/claude-agent-sdk`, builds options (cwd, canUseTool, resume, etc.), and runs one loop. There is no abstraction over "an agent backend."

**Needed abstraction:**

- **Backend interface:** e.g. `AgentBackend` with `start(options: AgentBackendStartOptions): Promise<void>`, `stop(sessionId)`. Options include sessionId, workspace path, prompt, model, mode, resume id, abort signal, tool approval callback, and event callbacks (`onMessage`, `onResult`, `onError`, `onProviderSessionId`). See **docs/agent-backend.md** and `apps/desktop/src/services/agent-backend-types.ts`.
- **Implementations:**
  - **Claude backend:** current `runAgent` logic (keep using `query()`, map to existing callbacks).
  - **Codex backend:** Codex SDK (or MCP) with `startThread({ workingDirectory })`, `thread.run(prompt)` / `runStreamed()`, map events to the same `AgentMessage` / `AgentResult` shape and map Codex approval to existing tool-approval UI.
- **Router:** In `agent-manager.ts`, from `AgentStartParams.provider` (default `"claude"`), select backend and call `backend.start(...)`; return our `sessionId`. IPC and store unchanged.

**Documentation:** **docs/agent-backend.md** describes the contract, Claude/Codex mapping, and how to add another provider. Shared type `AgentProvider` and `AgentStartParams.provider` in `packages/shared`.

---

### 2.2 Electron API access (getElectronAPI everywhere)

**Current state:** Many components and stores call `getElectronAPI()` directly and then use `api.agent`, `api.workspace`, etc. There is no indirection, so testing or swapping to a mock/fake is hard.

**Locations:** `agent.store`, `workspace.store`, `ui.store`, `git-changes-panel`, `git-changes-drawer`, `git-commit-dialog`, `file-tree`, `file-viewer-drawer`, `terminal-panel`, `api-key-dialog`, `use-workspace-files`, `use-agent-skills`, `create-workspace-dialog`, `app-layout`, `web-view-drawer`, `tasks-page`, etc.

**Needed abstraction:**

- **Option A:** A small "API context" or injectable: e.g. `getAgentAPI()`, `getWorkspaceAPI()`, `getChatAPI()` that read from a React context or a global injector (so tests can provide a mock).
- **Option B:** Keep `getElectronAPI()` but add a thin layer (e.g. `services/electron-api.ts`) that re-exposes the same shape and can be replaced in tests.

**Recommendation:** Document that "all Electron IPC is accessed via `getElectronAPI()`" and add a short "Testing" section: to unit-test stores or hooks that call IPC, inject a mock that implements the same interface. Prefer one place that defines the interface (shared `ElectronAPI`) and one place that provides it (preload + optional test double).

---

### 2.3 Prompt building (text + mentions + skills)

**Current state:** Prompt is built in `agent-panel.tsx`: `getText()` + optional skill hint. No central place that knows about editor structure, mention resolution, or future "system" additions.

**Needed abstraction:**

- **Prompt builder:** Input = editor state (or getJSON()), workspace path, optional skill names. Output = string (and optionally structured parts for the backend). Responsible for: stripping/escaping, resolving file mentions (read file), resolving code mentions (embed snippet + optional comment), appending skill hint.
- **Ownership:** Either a pure function in `utils/` or a small module used by `agent-panel` before calling `startAgent`. The agent store should receive the final prompt string; it need not know about TipTap or mentions.

**Recommendation:** Add `docs/prompt-building.md` (or a section in this doc) describing: where the prompt is built, what is included (plain text, file content, code snippet, skill hint), and how to add new context (e.g. diff, branch name).

---

## 3. Refactoring candidates

### 3.1 Git panel: type cast and method names

**File:** `apps/app/src/components/git-changes-panel.tsx`

- Remove the cast around `api.workspace.getStagedChanges` by ensuring `ElectronAPI.workspace` has the correct method and return type.
- Use the same naming as shared API (`getStagedChanges` / `getUnstagedChanges`); if the backend uses different names, wrap them in preload so the app only sees the shared names.

---

### 3.2 Workspace store: silent failures and non-assertive updates

**File:** `apps/app/src/store/workspace.store.ts`

- Many methods do `if (!api) return;` and then `set({ isLoading: false })` on failure without setting an error state. Failures are silent for the user.
- `deleteWorkspace` calls `setSavedActiveWorkspaceId(null)` inside `set()`; that side effect is easy to miss. Prefer calling it outside or documenting the invariant.

**Recommendation:** Add an optional `error: string | null` (or per-action error) and surface it in the UI where relevant. Document that workspace actions can fail and how the UI should show it.

---

### 3.3 Agent store: size and single responsibility

**File:** `apps/app/src/store/agent.store.ts`

- The store is large (600+ lines): threads, runtime, persistence, checkpoints, tool approval, listeners, and message/result handling in one place.
- Persistence is mixed with in-memory state (localStorage fallback when Electron API is absent).

**Recommendation:** Consider splitting into:
- **Agent state:** threads, activeThreadId, threadRuntime, sessionToThread, pendingToolApprovals (pure state + sync actions).
- **Agent persistence:** load/save per workspace (could live in a separate module or a thin wrapper that uses the store and IPC/localStorage).
- **Agent listeners:** init/teardown and mapping IPC events into store actions (could be a hook or a small service).

Document the intended boundaries even if you don't split immediately (e.g. "Agent state", "Persistence", "IPC listeners").

---

### 3.4 Tool approval: optional callback and typing

**Current state:** `agent.store` uses `api.agent.onToolApprovalRequest?.(...)` (optional). IPC and preload do send tool approval requests; the optional chaining suggests uncertainty about the type or presence of the API.

**Recommendation:** Ensure `ElectronAPI.agent` always declares `onToolApprovalRequest` in shared types and preload implements it so the store doesn't need optional chaining. Document the flow: main sends `AGENT_TOOL_APPROVAL_REQUEST`, renderer shows bar, user responds, `respondToolApproval` is invoked.

---

### 3.5 Hardcoded model list and error copy

**File:** `apps/app/src/components/agent/agent-panel.tsx`

- `MODEL_OPTIONS` is a hardcoded array; adding Codex will require either a second list or a unified list with a provider field.
- Error message that mentions "Claude Code process" and "Resurf CLI" is hardcoded; better in a constant or a small "error hints" map keyed by error pattern.

**Recommendation:** Move model list to config or a shared constant (and later to provider-specific or combined model list). Move error hints to a small module or constant so they're easy to update and document.

---

## 4. Best-practice gaps

### 4.1 Inconsistent error handling and user feedback

- **Stores:** Many IPC calls don't set an error state on failure; they just return or set loading to false.
- **Components:** Some components (e.g. skills, api-key-dialog) handle loading/error locally; others rely on store or don't show errors.
- **Recommendation:** Define a simple pattern: "async actions set loading, then on success update state, on failure set error (and optionally revert)." Document it and apply in workspace and agent flows. Prefer one place per screen to show "last error" (e.g. toast or inline) rather than ad-hoc alerts.

---

### 4.2 Direct dependency on Electron in UI

- **Pattern:** Components and hooks call `getElectronAPI()` directly. In a non-Electron environment (e.g. web or tests), `api` is null and code often bails without a clear path.
- **Recommendation:** Document that the app is "Electron-first" and that null `api` is expected in non-packaged environments. For tests, document that a mock must be injected (e.g. via context or a test setup that sets `window.electronAPI`). Avoid scattering `if (!api) return` without a single place that explains the contract.

---

### 4.3 Agent skills: window.electronAPI bypass

**File:** `apps/app/src/components/agent-skills/agent-skills.tsx`

- Uses `window.electronAPI?.skills` and a custom `declare const window` type instead of `getElectronAPI()` and shared `ElectronAPI`.
- **Recommendation:** Use `getElectronAPI()?.skills` and shared types so skills use the same API layer and types as the rest of the app. Document that all IPC access should go through the shared API type.

---

### 4.4 Path and string utilities duplicated

- **Examples:** `dirname`/`basename` in `git-changes-panel.tsx`; `normalizeWorkspacePath` and path logic in `agent-panel.tsx`. Similar logic may exist elsewhere.
- **Recommendation:** Move to a small `utils/path.ts` (or `utils/git-path.ts`) and reuse. Use consistent rules for separators and workspace-relative paths. Document where "workspace-relative" is required (e.g. agent, git) and where absolute paths are used.

---

### 4.5 Magic strings and constants

- **Examples:** Storage keys (`agentide-chat`, `agentide-selected-model`, `agentide-active-workspace`), IPC channel names (centralized in `ipc-channels.ts` but not all call sites use the constant), tool names in `MUTATING_TOOL_NAMES` and in `agent-panel` / tool components.
- **Recommendation:** Keep IPC and storage keys in shared or a single `constants.ts`; reference them everywhere. Document where tool names come from (SDK) and that UI logic (e.g. changed-files extraction) must stay in sync with those names.

---

## 5. Documentation layout (all under docs/)

| Doc | Purpose |
|-----|---------|
| **docs/foundation.md** | How to correct the foundation: order of operations and steps. |
| **docs/CODEBASE-REFACTOR.md** | This file: gaps, abstractions, refactors, best practices. |
| **docs/agent-backend.md** | Agent backend contract, Claude/Codex mapping, adding a provider. |
| **docs/electron-api.md** | IPC channels, `ElectronAPI` shape, preload contract, type sync. |
| **docs/prompt-building.md** | Where prompt is built, what's included (text, mentions, skills), adding context. |
| **docs/editor-integration.md** | "Open in Cursor" (and similar) behavior and CLI contract. |
| **docs/checkpoint.md** | Already exists; ensure it references git stash/refs and conversation rewind. |
| **docs/codex-agent-guide.md** | Already exists; Codex SDK/MCP reference. |
| **docs/claude-agent-sdk-guide.md** | Already exists; Claude Agent SDK reference. |

**README or CONTRIBUTING:** Point to `docs/` and state that new features (e.g. new agent provider, new IPC) should update the relevant doc and shared types.

---

## 6. Priority summary

| Priority | Item |
|----------|------|
| P0 | Align preload with shared types (chat.save, agent.start params, method names). |
| P0 | Document and fix prompt building (file/code mentions not sent to agent). |
| P0 | Agent backend abstraction: contract with **capabilities** + **provider-driven models** + resume-across-provider handling. Extract Claude; prepare for Codex. |
| P1 | Provider-aware auth (per-provider API keys, extend AuthMethod, update ApiKeyDialog). |
| P1 | Provider-aware UI (provider selector, modes gated by capabilities, model list from backend). |
| P1 | Add Codex backend implementation. |
| P1 | Fix Git panel type cast and API naming; add visible Push. |
| P1 | Add "Open in Cursor" and document editor integration. |
| P2 | ChatData + sdkSessionId + ChatThread.provider type alignment; remove duplicate ChatEditor if unused. |
| P2 | Centralize Electron API access (or document and add test double). |
| P2 | Agent store: document boundaries; optionally split state / persistence / listeners. |
| P3 | Consistent error handling and user feedback; path utils; reduce magic strings. |

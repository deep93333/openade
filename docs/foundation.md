# How to Correct the Foundation

The **foundation** is the layer everything else builds on: shared types and the process boundary (preload/main), then the core abstractions (agent backend, prompt building). Correct it in this order so later work doesn't have to be redone.

---

## 1. What "foundation" means

| Layer | What it is | Why it matters |
|-------|------------|----------------|
| **Contract** | `packages/shared`: types (`AgentStartParams`, `ChatData`, `ElectronAPI`, `AuthMethod`, etc.) and IPC channel names. Preload and main must match this. | One source of truth across renderer/main; no silent bugs from wrong params or return shapes. |
| **Process boundary** | Preload exposes `window.electronAPI`; main handles IPC. Both must use shared types and channels. | Type safety and consistency at the only process boundary. |
| **Core abstractions** | Agent backend (one interface, Claude/Codex impls, capabilities, model list), prompt builder (editor → final prompt). | Adding Codex or new context doesn't require rewiring the whole app. |

---

## 2. Order of operations

Do these in order. Each step unblocks the next.

### Phase A: Contract (shared + preload)

1. **Align shared types with reality**
   - `ChatData`: add `sdkSessionId?: string` if desktop persists it at top level; otherwise document the separate persisted shape.
   - `ChatThread`: add `provider?: AgentProvider` so we know which provider's session id is stored (done).
   - `AuthMethod`: extend with `"codex_api_key" | "codex_login"` for Codex auth (done).
   - `AgentStartParams`: add `provider?: AgentProvider` (done).
   - Ensure `ElectronAPI` in shared matches what main and renderer actually use (method names, return types).

2. **Preload uses shared types**
   - In `apps/desktop/src/preload.ts`: import and use `AgentStartParams`, `ChatData`, `ToolApprovalResponse`, etc. from `@agentide/shared`.
   - Type `agent.start` params as `AgentStartParams` (not `{ prompt: string; workspaceId: string }`).
   - Type `chat.save` data as `ChatData` (not `{ messages: unknown[] }`).
   - Expose same method names as `ElectronAPI` (e.g. `getStagedChanges` typed correctly).
   - Add `chat.deleteThread` to preload (it's in shared type but may be missing from preload).

3. **Remove type casts in app**
   - `git-changes-panel.tsx`: remove the cast around `getStagedChanges` once preload and `ElectronAPI` declare it.

**Done when:** Preload and main only use types from `@agentide/shared` for IPC, and the app has zero casts for workspace/agent/chat APIs.

---

### Phase B: Core abstractions

4. **Agent backend abstraction with capabilities**
   - Use the `AgentBackend` contract from `agent-backend-types.ts` (see **docs/agent-backend.md**):
     - `provider`: provider id.
     - `capabilities`: `{ supportedModes, supportsToolApproval, supportsImageAttachments, supportsResume }`.
     - `models`: `ModelOption[]` per provider.
     - `start(options)` / `stop(sessionId)`.
   - Extract current Claude logic from `agent-manager.ts` into `claude-agent-backend.ts` implementing `AgentBackend`.
   - In `agent-manager.ts`, build a registry of backends, select by `params.provider ?? "claude"`, call `backend.start(...)`.
   - Handle **resume across provider switches**: if `thread.provider !== params.provider`, clear `resumeSessionId` and start fresh.
   - Expose `getModels()` and `getCapabilities(provider)` from the router (for UI to query, either directly or via a new IPC).

5. **Model list: provider-driven**
   - Remove hardcoded `MODEL_OPTIONS` from `agent-panel.tsx`.
   - Backend provides models per provider; app fetches (or IPC returns) the combined/filtered list.
   - UI shows models for the selected provider, or a combined list grouped by provider.

6. **Auth: provider-aware**
   - Extend `config-storage` and `ApiKeyDialog` to handle per-provider keys (Anthropic API key, Codex/OpenAI API key, CLI login per provider).
   - Each backend reads its own auth from config-storage or env.

7. **Prompt builder**
   - New module: `apps/app/src/utils/build-prompt.ts`.
   - Input: editor JSON (getJSON()), workspace path, skill names.
   - Walks mention nodes:
     - File mention (id = path) → read file content via IPC, append to prompt.
     - Code mention (id = JSON with filePath, code, lines) → embed snippet.
     - Skill mention → skill hint.
   - Output: final prompt string.
   - `agent-panel.tsx` calls this before `startAgent`.
   - Document in `docs/prompt-building.md`.

**Done when:** Adding Codex = implement `AgentBackend` + register; model list comes from backend; auth is per-provider; mentions resolve to real content in the prompt.

---

### Phase C: Consistency and cleanup

8. **Single Electron API entry**
   - `getElectronAPI()` and shared `ElectronAPI` everywhere. Replace `window.electronAPI` in `agent-skills.tsx`.
   - Document in `docs/electron-api.md`.

9. **UI: provider-aware**
   - Provider selector in the chat toolbar (or combined with model selector).
   - Mode selector shows only `capabilities.supportedModes` for the selected provider.
   - Approval toggle visible only when `capabilities.supportsToolApproval`.
   - Image attach visible only when `capabilities.supportsImageAttachments`.

10. **Optional cleanups**
    - Remove duplicate `chat-editor.tsx` at component root if unused.
    - Add visible "Push" and fix Git API naming.
    - Shared path helpers and constants.
    - Agent store: split state / persistence / listeners (or at least document boundaries).

---

## 3. Checklist

- [ ] **A1** Shared types aligned: `ChatData`, `ChatThread.provider`, `AuthMethod`, `AgentStartParams.provider`, `ElectronAPI` method names/types.
- [ ] **A2** Preload: imports shared types; all params and returns typed; no underspecified params.
- [ ] **A3** App: no casts for workspace/agent/chat APIs.
- [ ] **B4** Agent backend: contract with `capabilities` + `models`; Claude extracted; router selects by provider; resume across provider switches handled.
- [ ] **B5** Model list: provider-driven, not hardcoded.
- [ ] **B6** Auth: per-provider keys/login in config-storage and UI.
- [ ] **B7** Prompt builder: resolves mentions → final prompt; used by agent-panel.
- [ ] **C8** All IPC via `getElectronAPI()` and shared types.
- [ ] **C9** UI: provider selector; mode/approval/images gated by capabilities.
- [ ] **C10** (Optional) Duplicate ChatEditor removed; Push visible; path/constants centralized; agent store boundaries documented.

---

## 4. Where things live

| Concern | Location |
|---------|----------|
| Shared types & IPC channels | `packages/shared/src/` (`types.ts`, `electron-api.ts`, `ipc-channels.ts`) |
| Process boundary | `apps/desktop/src/preload.ts`, `apps/desktop/src/ipc.ts` |
| Backend contract | `apps/desktop/src/services/agent-backend-types.ts` |
| Router | `apps/desktop/src/services/agent-manager.ts` |
| Claude backend | `apps/desktop/src/services/claude-agent-backend.ts` (extract) |
| Codex backend | `apps/desktop/src/services/codex-agent-backend.ts` (new) |
| Prompt building | `apps/app/src/utils/build-prompt.ts` (new) |
| Auth config | `apps/desktop/src/services/config-storage.ts` |
| Docs | `docs/` (foundation.md, CODEBASE-REFACTOR.md, agent-backend.md, electron-api.md, prompt-building.md) |

Once Phase A and B are done, the foundation is in place: correct contract, provider-aware backend with capabilities, provider-driven models, per-provider auth, and a prompt builder that resolves mentions into real content.

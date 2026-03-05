# Usage review: apps/desktop and packages/agent

## Summary

| Area | Used | Unused / Notes |
|------|------|----------------|
| **apps/desktop** | All 18 modules are in the dependency graph | None |
| **packages/agent** | All 18 modules are used internally; desktop uses 4 exports | 1 export never consumed: `getToolIds` |

---

## apps/desktop — what’s used

### Entry and process boundary

| File | Used by | Role |
|------|--------|------|
| `main.ts` | Entry | Registers IPC, menu, creates app window |
| `preload.ts` | `app-window.ts` (bundled as preload.js) | Exposes `window.electronAPI` to renderer |
| `preload-log.ts` | `log-window.ts` (preload for log window) | Exposes `window.logAPI` for log window |
| `ipc.ts` | `main.ts` | All IPC handlers |
| `menu.ts` | `main.ts` | App menu; opens log window |

### Windows

| File | Used by | Role |
|------|--------|------|
| `windows/app-window.ts` | `main.ts`, `ipc.ts` | Main BrowserWindow, preload |
| `windows/log-window.ts` | `menu.ts` | Log viewer window, preload-log |

### Services (all used by `ipc.ts` and/or each other)

| File | Used by | Role |
|------|--------|------|
| `services/agent-manager.ts` | `ipc.ts` | Wraps `@agentide/agent`, start/stop/models/title |
| `services/agent-log.ts` | `ipc.ts`, `agent-manager.ts` | Log path, read, write |
| `services/chat-storage.ts` | `ipc.ts` | Load/save chat per workspace |
| `services/config-storage.ts` | `ipc.ts`, `agent-manager.ts` | API keys, auth |
| `services/workspace-manager.ts` | `ipc.ts` | Workspace CRUD, git refresh |
| `services/workspace-events.ts` | `ipc.ts` | Active workspace, file/git change events |
| `services/git-service.ts` | `ipc.ts`, `workspace-manager.ts` | Git operations |
| `services/terminal-service.ts` | `ipc.ts` | PTY terminals |

### Tests and assets

| File | Role |
|------|------|
| `ipc.checkpoint.test.ts` | Checkpoint IPC tests; mocks services |
| `services/git-service.test.ts` | Git service tests |
| `icons/agentide.icns` | App icon (build/packaging) |

**Conclusion:** Every desktop source file is on the dependency graph. Nothing to remove.

---

## packages/agent — what’s used

### Consumer: only apps/desktop

`@agentide/agent` is only imported in:

- `apps/desktop/src/services/agent-manager.ts`

**Imports from `@agentide/agent`:**

- `createAgentManager`
- `createCustomAgentBackend`
- `generateThreadTitle` (as `generateThreadTitleForBackend`)
- `AgentBackendConfig` (type)

`apps/app` does **not** import `@agentide/agent`; it uses `@agentide/shared` and `@agentide/ui` only.

### Public API (packages/agent/src/index.ts)

| Export | Used by desktop? | Used elsewhere? |
|--------|-------------------|-----------------|
| `createAgentManager` | Yes | — |
| `createCustomAgentBackend` | Yes | — |
| `generateThreadTitle` | Yes | — |
| `AgentBackendConfig` | Yes | — |
| `AgentBackend`, `AgentBackendStartOptions`, `ToolApprovalResult`, `ModelOption`, `ProviderCapabilities` | No (types for backend impl) | — |
| `AgentManagerOptions`, `AgentManager` | No | — |
| `buildSystemPrompt`, `COMPACTION_PROMPT` | No | Only inside `custom-agent-backend.ts` |
| `createToolSet`, `ToolCallMetadata` | No | Only inside `custom-agent-backend.ts` |
| **`getToolIds`** | **No** | **Not used anywhere** |
| `ToolContext`, `ToolResult`, `ToolDefinition` | No | Types for tools |

So: all package code is used internally; the only export with **no** references in the repo is **`getToolIds`**.

### Internal usage (all modules used)

| Module | Used by |
|--------|---------|
| `agent-backend-types.ts` | `index`, `agent-manager`, `custom-agent-backend` |
| `agent-manager.ts` | `index` |
| `custom-agent-backend.ts` | `index`, uses `registry`, `system-prompt`, `tool-types` |
| `system-prompt.ts` | `index`, `custom-agent-backend` |
| `tools/registry.ts` | `index`, `custom-agent-backend`; uses all 11 tools |
| `tools/tool-types.ts` | `index`, `custom-agent-backend`, `registry` |
| `tools/read.ts`, `write.ts`, `edit.ts`, `bash.ts`, `grep.ts`, `glob.ts`, `ls.ts`, `todowrite.ts`, `delete.ts`, `readlints.ts`, `ask-question.ts` | `registry.ts` only |

All 11 tools are used in `createToolSet` (and a subset in `createReadOnlyToolSet`). No dead tools.

---

## Recommendations

1. **`getToolIds` (packages/agent)**  
   - Exported but never used in this repo.  
   - **Options:** remove from `index.ts` if you don’t plan to use it (e.g. for validation or tool allowlists), or keep as part of the public API for external/tooling use.

2. **Desktop**  
   - No unused files or dead code to remove.

3. **Agent package**  
   - All files and all tools are used; only `getToolIds` is an “unused export” candidate.

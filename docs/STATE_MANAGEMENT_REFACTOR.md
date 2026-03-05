# State Management Refactor — Implementation Guide

## Goal

Restructure all Zustand stores to support **parallel agent sessions across multiple workspaces simultaneously**. Currently the app keeps only one workspace's threads in memory at a time and has a single global `activeThreadId`, which causes state corruption when two workspaces run agents in parallel.

This is a **start-fresh rewrite** of all store files. Components are updated to match. No migration path is needed — existing localStorage/Electron data shapes are compatible.

---

## Current File Inventory (What You Are Replacing)

```
apps/app/src/store/
  agent.store.ts              ← full rewrite
  workspace.store.ts          ← full rewrite
  navigation.store.ts         ← deleted, merged into ui.store.ts
  cost.store.ts               ← kept as-is, no changes
  file-context.store.ts       ← kept as-is, no changes
  create-branch-dialog.store.ts ← deleted, merged into ui.store.ts
  ui.store.ts                 ← NEW FILE (replaces navigation + create-branch-dialog)
```

---

## Overview of All Changes

| File | Action | Reason |
|---|---|---|
| `store/agent.store.ts` | Full rewrite | Add `workspaces: Record<workspaceId, WorkspaceAgentState>` |
| `store/workspace.store.ts` | Full rewrite | Remove circular import of agent store |
| `store/ui.store.ts` | New file | Consolidate navigation + dialog state |
| `store/navigation.store.ts` | Delete | Merged into ui.store |
| `store/create-branch-dialog.store.ts` | Delete | Merged into ui.store |
| `store/cost.store.ts` | No change | Fine as-is |
| `store/file-context.store.ts` | No change | Fine as-is |
| `layouts/app-layout.tsx` | Update imports | Subscribe agent store to workspace changes here |
| `components/sidebar/index.tsx` | Update imports | Switch from navigation store to ui store |
| `components/agent/agent-panel.tsx` | Update store calls | Pass workspaceId to all agent actions |
| `components/agent/message-list.tsx` | Update selectors | Scope to workspaceId |
| `components/agent/tool-approval-bar.tsx` | Update selectors | Read from workspace-scoped approval |
| `components/sidebar/create-branch-dialog.tsx` | Update imports | Switch to ui store |
| Any file importing `useNavigationStore` | Update import | Switch to `useUIStore` |
| Any file importing `useCreateBranchDialogStore` | Update import | Switch to `useUIStore` |
| `packages/shared/src/types.ts` | Minor cleanup | Remove unused `AgentSession`, remove `Workspace.activeSessionId` |

---

## Step 1 — Create `store/ui.store.ts` (New File)

Create this file. It replaces `navigation.store.ts` and `create-branch-dialog.store.ts`.

```typescript
// apps/app/src/store/ui.store.ts
import { create } from "zustand";

export type NavigationView = "files" | "changes";
export type CenterPage = "chat" | "skills";

type UIStoreState = {
  // Navigation
  activeView: NavigationView;
  centerPage: CenterPage;
  setActiveView: (view: NavigationView) => void;
  setCenterPage: (page: CenterPage) => void;

  // Create branch dialog
  createBranchDialog: { open: boolean; workspaceId: string | null };
  openCreateBranchDialog: (workspaceId: string) => void;
  closeCreateBranchDialog: () => void;
};

export const useUIStore = create<UIStoreState>()((set) => ({
  activeView: "files",
  centerPage: "chat",
  setActiveView: (view) => set({ activeView: view }),
  setCenterPage: (page) => set({ centerPage: page }),

  createBranchDialog: { open: false, workspaceId: null },
  openCreateBranchDialog: (workspaceId) =>
    set({ createBranchDialog: { open: true, workspaceId } }),
  closeCreateBranchDialog: () =>
    set({ createBranchDialog: { open: false, workspaceId: null } }),
}));
```

---

## Step 2 — Rewrite `store/agent.store.ts`

This is the most important change. Replace the entire file contents with the following.

**Key structural changes vs current:**
- `threads`, `activeThreadId`, `threadState`, `sessionToThread` are no longer top-level fields
- They all live inside `workspaces: Record<string, WorkspaceAgentState>`
- `threadRuntime` replaces `threadState` — it holds only ephemeral runtime data (status, streaming text, error). Messages are stored only in `ChatThread.messages` (single source of truth)
- `pendingToolApprovals` is now `Record<workspaceId, ToolApprovalRequest | null>` so parallel approvals don't overwrite each other
- `sessionToThread` is per-workspace, not global
- `addMessage` and `setResult` iterate all workspaces to find the right session (no workspaceId needed on IPC events)
- All actions that modify threads take `workspaceId` as their first argument
- `loadWorkspace(workspaceId)` replaces `loadHistory(workspaceId)` — it loads and keeps in memory without replacing other workspaces
- `workspace.store` no longer imports `agent.store` — coordination happens via subscriber in app-layout

```typescript
// apps/app/src/store/agent.store.ts
import type {
  AgentMessage,
  AgentResult,
  AgentStatus,
  ChatData,
  ChatThread,
  Checkpoint,
  ImageAttachment,
  ToolApprovalRequest,
} from "@agentide/shared";
import { create } from "zustand";
import { getElectronAPI } from "@/lib/electron";
import { useCostStore } from "./cost.store";

const CHAT_STORAGE_KEY = "agentide-chat";
const DEFAULT_MODEL = "claude-sonnet-4-20250514";

// ─── Types ───────────────────────────────────────────────────────────────────

/** Ephemeral per-thread runtime state. Never persisted. */
type ThreadRuntime = {
  status: AgentStatus;
  error: string | null;
  streamingText: string;
  sessionId: string | null; // currently-running IPC session ID for this thread
};

const EMPTY_RUNTIME: ThreadRuntime = {
  status: "idle",
  error: null,
  streamingText: "",
  sessionId: null,
};

/** All state for a single workspace's agent/chat system */
type WorkspaceAgentState = {
  threads: ChatThread[];
  activeThreadId: string;
  threadRuntime: Record<string, ThreadRuntime>; // keyed by threadId
  sessionToThread: Record<string, string>;       // sessionId → threadId (this workspace only)
};

const EMPTY_WORKSPACE_STATE: WorkspaceAgentState = {
  threads: [],
  activeThreadId: "",
  threadRuntime: {},
  sessionToThread: {},
};

type AgentStoreState = {
  // All workspace state — keyed by workspaceId. All loaded workspaces live here simultaneously.
  workspaces: Record<string, WorkspaceAgentState>;

  // Global settings — not workspace-specific
  selectedModel: string;
  requireApproval: boolean;

  // Per-workspace tool approval — keyed by workspaceId so parallel approvals don't collide
  pendingToolApprovals: Record<string, ToolApprovalRequest | null>;

  // ── Workspace lifecycle ──────────────────────────────────────────────────
  loadWorkspace: (workspaceId: string) => Promise<void>;
  unloadWorkspace: (workspaceId: string) => void;
  persistWorkspace: (workspaceId: string) => Promise<void>;

  // ── Thread management ────────────────────────────────────────────────────
  startNewThread: (workspaceId: string) => Promise<void>;
  switchThread: (workspaceId: string, threadId: string) => void;
  deleteThread: (workspaceId: string, threadId: string) => Promise<void>;

  // ── Agent execution ──────────────────────────────────────────────────────
  startAgent: (
    workspaceId: string,
    prompt: string,
    options?: { displayContent?: string; imageAttachments?: ImageAttachment[] }
  ) => Promise<void>;
  stopAgent: (workspaceId: string) => Promise<void>;

  // ── IPC message handlers (called by initListeners) ───────────────────────
  addMessage: (message: AgentMessage) => void;
  setResult: (result: AgentResult) => void;
  setError: (payload: { sessionId: string; error: string }) => void;

  // ── Tool approval ────────────────────────────────────────────────────────
  setPendingToolApproval: (workspaceId: string, request: ToolApprovalRequest | null) => void;
  respondToolApproval: (workspaceId: string, allow: boolean, message?: string) => Promise<void>;
  clearError: (workspaceId: string) => void;

  // ── Settings ─────────────────────────────────────────────────────────────
  setSelectedModel: (model: string) => void;
  setRequireApproval: (value: boolean) => void;

  // ── Checkpoints ──────────────────────────────────────────────────────────
  createCheckpoint: (workspaceId: string) => Promise<Checkpoint | null>;
  rewindToCheckpoint: (
    workspaceId: string,
    checkpointId: string,
    mode: "both" | "conversation" | "code"
  ) => Promise<void>;

  // ── Selectors ────────────────────────────────────────────────────────────
  getWorkspaceState: (workspaceId: string) => WorkspaceAgentState;
  getActiveThread: (workspaceId: string) => ChatThread | null;
  getActiveRuntime: (workspaceId: string) => ThreadRuntime;
  getThreadRuntime: (workspaceId: string, threadId: string) => ThreadRuntime;
  getPendingToolApproval: (workspaceId: string) => ToolApprovalRequest | null;

  // ── IPC listener bootstrap ───────────────────────────────────────────────
  initListeners: () => () => void;
};

// ─── Storage helpers ─────────────────────────────────────────────────────────

function migrateLegacy(data: {
  messages?: AgentMessage[];
  threads?: ChatThread[];
  activeThreadId?: string;
}): ChatData {
  if (Array.isArray(data?.threads) && typeof data?.activeThreadId === "string") {
    return { threads: data.threads, activeThreadId: data.activeThreadId };
  }
  const messages = Array.isArray(data?.messages) ? data.messages : [];
  const threadId = crypto.randomUUID();
  return {
    threads: [{ id: threadId, messages, createdAt: Date.now() }],
    activeThreadId: threadId,
  };
}

const loadFromLocalStorage = (workspaceId: string): ChatData => {
  try {
    const raw = localStorage.getItem(`${CHAT_STORAGE_KEY}-${workspaceId}`);
    if (!raw) return { threads: [], activeThreadId: "" };
    const parsed = JSON.parse(raw) as Parameters<typeof migrateLegacy>[0];
    return migrateLegacy(parsed);
  } catch {
    return { threads: [], activeThreadId: "" };
  }
};

const saveToLocalStorage = (workspaceId: string, data: ChatData): void => {
  try {
    localStorage.setItem(
      `${CHAT_STORAGE_KEY}-${workspaceId}`,
      JSON.stringify({ threads: data.threads, activeThreadId: data.activeThreadId })
    );
  } catch {
    // ignore
  }
};

// ─── Store ───────────────────────────────────────────────────────────────────

export const useAgentStore = create<AgentStoreState>()((set, get) => ({
  workspaces: {},
  selectedModel: DEFAULT_MODEL,
  requireApproval: true,
  pendingToolApprovals: {},

  // ── Selectors ──────────────────────────────────────────────────────────────

  getWorkspaceState: (workspaceId) =>
    get().workspaces[workspaceId] ?? EMPTY_WORKSPACE_STATE,

  getActiveThread: (workspaceId) => {
    const ws = get().workspaces[workspaceId];
    if (!ws) return null;
    return ws.threads.find((t) => t.id === ws.activeThreadId) ?? null;
  },

  getActiveRuntime: (workspaceId) => {
    const ws = get().workspaces[workspaceId];
    if (!ws) return EMPTY_RUNTIME;
    return ws.threadRuntime[ws.activeThreadId] ?? EMPTY_RUNTIME;
  },

  getThreadRuntime: (workspaceId, threadId) => {
    const ws = get().workspaces[workspaceId];
    return ws?.threadRuntime[threadId] ?? EMPTY_RUNTIME;
  },

  getPendingToolApproval: (workspaceId) =>
    get().pendingToolApprovals[workspaceId] ?? null,

  // ── Workspace lifecycle ────────────────────────────────────────────────────

  loadWorkspace: async (workspaceId) => {
    // If already loaded, do nothing (preserve in-flight runtime state)
    if (get().workspaces[workspaceId]) return;

    const api = getElectronAPI();
    let threads: ChatThread[] = [];
    let activeThreadId = "";

    if (api?.chat) {
      const result = await api.chat.load(workspaceId);
      if (result.success && result.data) {
        threads = result.data.threads ?? [];
        activeThreadId = result.data.activeThreadId ?? "";
      }
    }
    if (threads.length === 0) {
      const data = loadFromLocalStorage(workspaceId);
      threads = data.threads;
      activeThreadId = data.activeThreadId;
    }
    if (threads.length === 0) {
      const threadId = crypto.randomUUID();
      threads = [{ id: threadId, messages: [], createdAt: Date.now() }];
      activeThreadId = threadId;
    }

    const resolved = threads.find((t) => t.id === activeThreadId) ?? threads[0];
    const resolvedId = resolved?.id ?? "";

    // Build runtime from loaded threads — all start idle
    const threadRuntime: Record<string, ThreadRuntime> = {};
    for (const t of threads) {
      threadRuntime[t.id] = { ...EMPTY_RUNTIME };
    }

    set((s) => ({
      workspaces: {
        ...s.workspaces,
        [workspaceId]: {
          threads,
          activeThreadId: resolvedId,
          threadRuntime,
          sessionToThread: {},
        },
      },
    }));
  },

  unloadWorkspace: (workspaceId) => {
    set((s) => {
      const next = { ...s.workspaces };
      delete next[workspaceId];
      const nextApprovals = { ...s.pendingToolApprovals };
      delete nextApprovals[workspaceId];
      return { workspaces: next, pendingToolApprovals: nextApprovals };
    });
  },

  persistWorkspace: async (workspaceId) => {
    const ws = get().workspaces[workspaceId];
    if (!ws || (ws.threads.length === 0 && !ws.activeThreadId)) return;

    const data: ChatData = {
      threads: ws.threads,
      activeThreadId: ws.activeThreadId,
    };

    const api = getElectronAPI();
    if (api?.chat) {
      await api.chat.save(workspaceId, data);
      return;
    }
    saveToLocalStorage(workspaceId, data);
  },

  // ── Thread management ──────────────────────────────────────────────────────

  startNewThread: async (workspaceId) => {
    const threadId = crypto.randomUUID();
    const newThread: ChatThread = {
      id: threadId,
      messages: [],
      createdAt: Date.now(),
    };

    set((s) => {
      const ws = s.workspaces[workspaceId] ?? EMPTY_WORKSPACE_STATE;
      return {
        workspaces: {
          ...s.workspaces,
          [workspaceId]: {
            ...ws,
            threads: [...ws.threads, newThread],
            activeThreadId: threadId,
            threadRuntime: { ...ws.threadRuntime, [threadId]: { ...EMPTY_RUNTIME } },
          },
        },
      };
    });

    await get().persistWorkspace(workspaceId);
  },

  switchThread: (workspaceId, threadId) => {
    set((s) => {
      const ws = s.workspaces[workspaceId];
      if (!ws) return s;
      const thread = ws.threads.find((t) => t.id === threadId);
      if (!thread) return s;
      // Preserve runtime if already exists (could be running), else init idle
      const runtime = ws.threadRuntime[threadId] ?? { ...EMPTY_RUNTIME };
      return {
        workspaces: {
          ...s.workspaces,
          [workspaceId]: {
            ...ws,
            activeThreadId: threadId,
            threadRuntime: { ...ws.threadRuntime, [threadId]: runtime },
          },
        },
      };
    });
  },

  deleteThread: async (workspaceId, threadId) => {
    const ws = get().workspaces[workspaceId];
    if (!ws || ws.threads.length <= 1) return;

    const updatedThreads = ws.threads.filter((t) => t.id !== threadId);
    const newActiveId =
      ws.activeThreadId === threadId
        ? updatedThreads[0]?.id ?? ""
        : ws.activeThreadId;

    const { [threadId]: _removed, ...remainingRuntime } = ws.threadRuntime;

    set((s) => ({
      workspaces: {
        ...s.workspaces,
        [workspaceId]: {
          ...ws,
          threads: updatedThreads,
          activeThreadId: newActiveId,
          threadRuntime: remainingRuntime,
        },
      },
    }));

    const api = getElectronAPI();
    if (api?.chat) {
      await api.chat.deleteThread(workspaceId, threadId).catch(console.error);
    } else {
      saveToLocalStorage(workspaceId, { threads: updatedThreads, activeThreadId: newActiveId });
    }
  },

  // ── Agent execution ────────────────────────────────────────────────────────

  startAgent: async (workspaceId, prompt, options) => {
    const api = getElectronAPI();
    if (!api) return;

    const { selectedModel, requireApproval, createCheckpoint } = get();
    const ws = get().workspaces[workspaceId];
    if (!ws) return;

    const tid = ws.activeThreadId;
    await createCheckpoint(workspaceId);

    const images = options?.imageAttachments?.length ? options.imageAttachments : undefined;
    const userMessage: AgentMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: options?.displayContent ?? prompt,
      timestamp: Date.now(),
      imageAttachments: images,
    };

    // Append user message, mark thread as running
    set((s) => {
      const ws = s.workspaces[workspaceId];
      if (!ws) return s;
      const thread = ws.threads.find((t) => t.id === tid);
      if (!thread) return s;
      const updatedThread = { ...thread, messages: [...thread.messages, userMessage] };
      return {
        workspaces: {
          ...s.workspaces,
          [workspaceId]: {
            ...ws,
            threads: ws.threads.map((t) => (t.id === tid ? updatedThread : t)),
            threadRuntime: {
              ...ws.threadRuntime,
              [tid]: { ...EMPTY_RUNTIME, status: "running" },
            },
          },
        },
      };
    });

    const activeThread = get().workspaces[workspaceId]?.threads.find((t) => t.id === tid);
    const resumeSessionId = activeThread?.sdkSessionId;

    const result = await api.agent.start({
      prompt,
      workspaceId,
      activeThreadId: tid || undefined,
      model: selectedModel,
      requireApproval,
      resumeSessionId,
      imageAttachments: images,
    });

    if (result.success && result.data) {
      const sessionId = result.data.sessionId;
      set((s) => {
        const ws = s.workspaces[workspaceId];
        if (!ws) return s;
        return {
          workspaces: {
            ...s.workspaces,
            [workspaceId]: {
              ...ws,
              sessionToThread: { ...ws.sessionToThread, [sessionId]: tid },
              threadRuntime: {
                ...ws.threadRuntime,
                [tid]: { ...(ws.threadRuntime[tid] ?? EMPTY_RUNTIME), sessionId },
              },
            },
          },
        };
      });
    } else {
      set((s) => {
        const ws = s.workspaces[workspaceId];
        if (!ws) return s;
        return {
          workspaces: {
            ...s.workspaces,
            [workspaceId]: {
              ...ws,
              threadRuntime: {
                ...ws.threadRuntime,
                [tid]: {
                  ...EMPTY_RUNTIME,
                  status: "error",
                  error: result.error || "Failed to start agent",
                },
              },
            },
          },
        };
      });
    }
  },

  stopAgent: async (workspaceId) => {
    const api = getElectronAPI();
    const ws = get().workspaces[workspaceId];
    if (!api || !ws) return;

    const runtime = ws.threadRuntime[ws.activeThreadId];
    if (!runtime?.sessionId) return;

    const sessionId = runtime.sessionId;
    await api.agent.stop(sessionId);

    set((s) => {
      const ws = s.workspaces[workspaceId];
      if (!ws) return s;
      const nextSessionToThread = { ...ws.sessionToThread };
      delete nextSessionToThread[sessionId];
      return {
        workspaces: {
          ...s.workspaces,
          [workspaceId]: {
            ...ws,
            sessionToThread: nextSessionToThread,
            threadRuntime: {
              ...ws.threadRuntime,
              [ws.activeThreadId]: { ...EMPTY_RUNTIME, status: "stopped" },
            },
          },
        },
      };
    });
  },

  // ── IPC message routing ────────────────────────────────────────────────────
  // These are called from IPC callbacks. They receive a sessionId and must
  // find which workspace+thread owns that session by scanning all workspaces.

  addMessage: (message) => {
    const { workspaces } = get();

    // Find the workspace and thread that owns this session
    let targetWorkspaceId: string | null = null;
    let targetThreadId: string | null = null;

    for (const [wsId, wsState] of Object.entries(workspaces)) {
      const threadId = message.sessionId
        ? wsState.sessionToThread[message.sessionId]
        : wsState.activeThreadId;
      if (threadId) {
        targetWorkspaceId = wsId;
        targetThreadId = threadId;
        break;
      }
    }

    if (!targetWorkspaceId || !targetThreadId) return;
    const wsId = targetWorkspaceId;
    const threadId = targetThreadId;

    if (message.isPartial) {
      // Streaming chunk — append to streamingText only, no message array change
      set((s) => {
        const ws = s.workspaces[wsId];
        if (!ws) return s;
        const runtime = ws.threadRuntime[threadId] ?? EMPTY_RUNTIME;
        return {
          workspaces: {
            ...s.workspaces,
            [wsId]: {
              ...ws,
              threadRuntime: {
                ...ws.threadRuntime,
                [threadId]: {
                  ...runtime,
                  streamingText: runtime.streamingText + message.content,
                },
              },
            },
          },
        };
      });
      return;
    }

    // Commit message — flush streamingText into message content, append to thread
    set((s) => {
      const ws = s.workspaces[wsId];
      if (!ws) return s;
      const runtime = ws.threadRuntime[threadId] ?? EMPTY_RUNTIME;
      const finalContent = runtime.streamingText || message.content;
      const committed = { ...message, content: finalContent };
      const updatedThreads = ws.threads.map((t) =>
        t.id === threadId
          ? { ...t, messages: [...t.messages, committed] }
          : t
      );
      return {
        workspaces: {
          ...s.workspaces,
          [wsId]: {
            ...ws,
            threads: updatedThreads,
            threadRuntime: {
              ...ws.threadRuntime,
              [threadId]: { ...runtime, streamingText: "" },
            },
          },
        },
      };
    });
  },

  setResult: (result) => {
    if (result.totalCostUsd && result.totalCostUsd > 0) {
      useCostStore.getState().addCost(result.totalCostUsd);
    }

    const { workspaces } = get();
    let targetWorkspaceId: string | null = null;
    let targetThreadId: string | null = null;

    for (const [wsId, wsState] of Object.entries(workspaces)) {
      const threadId = wsState.sessionToThread[result.sessionId];
      if (threadId) {
        targetWorkspaceId = wsId;
        targetThreadId = threadId;
        break;
      }
    }

    if (!targetWorkspaceId || !targetThreadId) return;
    const wsId = targetWorkspaceId;
    const threadId = targetThreadId;

    set((s) => {
      const ws = s.workspaces[wsId];
      if (!ws) return s;
      const nextSessionToThread = { ...ws.sessionToThread };
      delete nextSessionToThread[result.sessionId];
      return {
        workspaces: {
          ...s.workspaces,
          [wsId]: {
            ...ws,
            sessionToThread: nextSessionToThread,
            threadRuntime: {
              ...ws.threadRuntime,
              [threadId]: {
                ...EMPTY_RUNTIME,
                status: result.success ? "idle" : "error",
                error: result.error || null,
              },
            },
          },
        },
      };
    });
  },

  setError: (payload) => {
    const { workspaces } = get();
    let targetWorkspaceId: string | null = null;
    let targetThreadId: string | null = null;

    for (const [wsId, wsState] of Object.entries(workspaces)) {
      const threadId = wsState.sessionToThread[payload.sessionId];
      if (threadId) {
        targetWorkspaceId = wsId;
        targetThreadId = threadId;
        break;
      }
    }

    if (!targetWorkspaceId || !targetThreadId) return;
    const wsId = targetWorkspaceId;
    const threadId = targetThreadId;

    set((s) => {
      const ws = s.workspaces[wsId];
      if (!ws) return s;
      const nextSessionToThread = { ...ws.sessionToThread };
      delete nextSessionToThread[payload.sessionId];
      return {
        workspaces: {
          ...s.workspaces,
          [wsId]: {
            ...ws,
            sessionToThread: nextSessionToThread,
            threadRuntime: {
              ...ws.threadRuntime,
              [threadId]: {
                ...EMPTY_RUNTIME,
                status: "error",
                error: payload.error,
              },
            },
          },
        },
      };
    });
  },

  clearError: (workspaceId) => {
    set((s) => {
      const ws = s.workspaces[workspaceId];
      if (!ws) return s;
      const runtime = ws.threadRuntime[ws.activeThreadId] ?? EMPTY_RUNTIME;
      return {
        workspaces: {
          ...s.workspaces,
          [workspaceId]: {
            ...ws,
            threadRuntime: {
              ...ws.threadRuntime,
              [ws.activeThreadId]: { ...runtime, error: null },
            },
          },
        },
      };
    });
  },

  // ── Tool approval ──────────────────────────────────────────────────────────

  setPendingToolApproval: (workspaceId, request) => {
    set((s) => ({
      pendingToolApprovals: { ...s.pendingToolApprovals, [workspaceId]: request },
    }));
  },

  respondToolApproval: async (workspaceId, allow, message) => {
    const api = getElectronAPI();
    const request = get().pendingToolApprovals[workspaceId];
    if (!api || !request) return;
    await api.agent.respondToolApproval({
      requestId: request.requestId,
      allow,
      message: allow ? undefined : message ?? "Denied by user",
    });
    set((s) => ({
      pendingToolApprovals: { ...s.pendingToolApprovals, [workspaceId]: null },
    }));
  },

  // ── Settings ───────────────────────────────────────────────────────────────

  setSelectedModel: (model) => set({ selectedModel: model }),
  setRequireApproval: (value) => set({ requireApproval: value }),

  // ── Checkpoints ───────────────────────────────────────────────────────────

  createCheckpoint: async (workspaceId) => {
    const api = getElectronAPI();
    if (!api?.checkpoint) return null;
    const ws = get().workspaces[workspaceId];
    if (!ws?.activeThreadId) return null;

    const thread = ws.threads.find((t) => t.id === ws.activeThreadId);
    const messageIndex = thread?.messages.length ?? 0;

    const result = await api.checkpoint.create({
      workspaceId,
      activeThreadId: ws.activeThreadId,
      messageIndex,
    });
    if (!result.success || !result.data) return null;

    const checkpoint = result.data;
    set((s) => {
      const ws = s.workspaces[workspaceId];
      if (!ws) return s;
      return {
        workspaces: {
          ...s.workspaces,
          [workspaceId]: {
            ...ws,
            threads: ws.threads.map((t) =>
              t.id === ws.activeThreadId
                ? { ...t, checkpoints: [...(t.checkpoints ?? []), checkpoint] }
                : t
            ),
          },
        },
      };
    });
    return checkpoint;
  },

  rewindToCheckpoint: async (workspaceId, checkpointId, mode) => {
    const api = getElectronAPI();
    const ws = get().workspaces[workspaceId];
    if (!ws) return;

    const thread = ws.threads.find((t) => t.id === ws.activeThreadId);
    const checkpoint = thread?.checkpoints?.find((c) => c.id === checkpointId);
    if (!checkpoint) return;

    const doConversation = mode === "conversation" || mode === "both";
    const doCode = mode === "code" || mode === "both";

    if (doConversation) {
      const truncated = (thread?.messages ?? []).slice(0, checkpoint.messageIndex);
      set((s) => {
        const ws = s.workspaces[workspaceId];
        if (!ws) return s;
        return {
          workspaces: {
            ...s.workspaces,
            [workspaceId]: {
              ...ws,
              threads: ws.threads.map((t) =>
                t.id === ws.activeThreadId ? { ...t, messages: truncated } : t
              ),
              threadRuntime: {
                ...ws.threadRuntime,
                [ws.activeThreadId]: {
                  ...EMPTY_RUNTIME,
                },
              },
            },
          },
        };
      });
      await get().persistWorkspace(workspaceId);
    }

    if (doCode && checkpoint.gitStashRef && api?.checkpoint) {
      const result = await api.checkpoint.restore({
        workspaceId,
        stashRef: checkpoint.gitStashRef,
      });
      if (!result.success) {
        get().setError({ sessionId: "", error: result.error ?? "Failed to restore code" });
      }
    }
  },

  // ── IPC listeners ──────────────────────────────────────────────────────────
  // Call once on app init. Returns cleanup function.

  initListeners: () => {
    const api = getElectronAPI();
    if (!api) return () => {};

    const removeMessage = api.agent.onMessage((message) => {
      get().addMessage(message);
    });

    const removeResult = api.agent.onResult((result) => {
      get().setResult(result);
    });

    const removeError = api.agent.onError((payload: { sessionId: string; error: string }) => {
      get().setError(payload);
    });

    // Tool approval: backend must send workspaceId with the request.
    // If it doesn't today, use the first workspace with a running session as fallback.
    const removeToolApproval = api.agent.onToolApprovalRequest?.((request: ToolApprovalRequest & { workspaceId?: string }) => {
      const workspaceId = request.workspaceId ?? findWorkspaceForSession(get().workspaces, request.sessionId);
      if (workspaceId) get().setPendingToolApproval(workspaceId, request);
    });

    const removeSdkSessionId = api.agent.onSdkSessionId?.((payload: { sdkSessionId: string; threadId: string; workspaceId?: string }) => {
      // Store the SDK session ID on the thread for potential future resumption
      const workspaceId = payload.workspaceId ?? findWorkspaceForThread(get().workspaces, payload.threadId);
      if (!workspaceId) return;
      set((s) => {
        const ws = s.workspaces[workspaceId];
        if (!ws) return s;
        return {
          workspaces: {
            ...s.workspaces,
            [workspaceId]: {
              ...ws,
              threads: ws.threads.map((t) =>
                t.id === payload.threadId ? { ...t, sdkSessionId: payload.sdkSessionId } : t
              ),
            },
          },
        };
      });
    });

    return () => {
      removeMessage();
      removeResult();
      removeError();
      removeToolApproval?.();
      removeSdkSessionId?.();
    };
  },
}));

// ─── Private helpers ─────────────────────────────────────────────────────────

function findWorkspaceForSession(
  workspaces: Record<string, WorkspaceAgentState>,
  sessionId?: string
): string | null {
  if (!sessionId) return null;
  for (const [wsId, ws] of Object.entries(workspaces)) {
    if (ws.sessionToThread[sessionId]) return wsId;
  }
  return null;
}

function findWorkspaceForThread(
  workspaces: Record<string, WorkspaceAgentState>,
  threadId: string
): string | null {
  for (const [wsId, ws] of Object.entries(workspaces)) {
    if (ws.threads.some((t) => t.id === threadId)) return wsId;
  }
  return null;
}
```

---

## Step 3 — Rewrite `store/workspace.store.ts`

Remove the dynamic `import("./agent.store")` entirely. The workspace store no longer knows about the agent store. Coordination happens via subscriber in `app-layout.tsx` (Step 6).

**Changes from current:**
- Remove all `useAgentStore` imports and calls
- `fileTreeVersion` and `gitChangeVersion` become `Record<string, number>` (per workspace) instead of a single global number

```typescript
// apps/app/src/store/workspace.store.ts
import type { Workspace, GitBranch } from "@agentide/shared";
import { create } from "zustand";
import { getElectronAPI } from "@/lib/electron";

const ACTIVE_WORKSPACE_KEY = "agentide-active-workspace";

async function getSavedActiveWorkspaceId(): Promise<string | null> {
  const api = getElectronAPI();
  if (api?.config) {
    const result = await api.config.getActiveWorkspaceId();
    return result.success && result.data ? result.data : null;
  }
  try {
    return localStorage.getItem(ACTIVE_WORKSPACE_KEY);
  } catch {
    return null;
  }
}

async function setSavedActiveWorkspaceId(workspaceId: string | null): Promise<void> {
  const api = getElectronAPI();
  if (api?.config) {
    await api.config.setActiveWorkspaceId(workspaceId);
    return;
  }
  try {
    if (workspaceId) {
      localStorage.setItem(ACTIVE_WORKSPACE_KEY, workspaceId);
    } else {
      localStorage.removeItem(ACTIVE_WORKSPACE_KEY);
    }
  } catch {
    // ignore
  }
}

type WorkspaceStoreState = {
  workspaces: Workspace[];
  activeWorkspaceId: string | null;
  isLoading: boolean;
  fileTreeVersions: Record<string, number>;  // per workspace
  gitChangeVersions: Record<string, number>; // per workspace

  // Derived selector
  getActiveWorkspace: () => Workspace | null;

  fetchWorkspaces: () => Promise<void>;
  createWorkspace: (name: string, path: string) => Promise<void>;
  deleteWorkspace: (id: string) => Promise<void>;
  selectWorkspace: (id: string) => Promise<void>;
  clearActiveWorkspace: () => void;
  initializeActiveWorkspace: () => Promise<void>;

  refreshGitInfo: (id: string) => Promise<void>;
  getGitBranches: (id: string) => Promise<GitBranch[]>;
  switchGitBranch: (id: string, branchName: string) => Promise<void>;
  createGitBranch: (id: string, branchName: string) => Promise<void>;

  notifyFilesChanged: (workspaceId: string) => void;
  notifyGitChanged: (workspaceId: string) => void;
};

export const useWorkspaceStore = create<WorkspaceStoreState>()((set, get) => ({
  workspaces: [],
  activeWorkspaceId: null,
  isLoading: false,
  fileTreeVersions: {},
  gitChangeVersions: {},

  getActiveWorkspace: () => {
    const { workspaces, activeWorkspaceId } = get();
    return workspaces.find((w) => w.id === activeWorkspaceId) ?? null;
  },

  fetchWorkspaces: async () => {
    const api = getElectronAPI();
    if (!api) return;
    set({ isLoading: true });
    const result = await api.workspace.list();
    if (result.success && result.data) {
      set({ workspaces: result.data, isLoading: false });
    } else {
      set({ isLoading: false });
    }
  },

  initializeActiveWorkspace: async () => {
    const savedWorkspaceId = await getSavedActiveWorkspaceId();
    if (!savedWorkspaceId) return;

    const api = getElectronAPI();
    if (!api) return;

    const result = await api.workspace.select(savedWorkspaceId);
    if (result.success && result.data) {
      set((s) => ({
        workspaces: s.workspaces.some((w) => w.id === result.data!.id)
          ? s.workspaces.map((w) => (w.id === result.data!.id ? result.data! : w))
          : [...s.workspaces, result.data!],
        activeWorkspaceId: result.data!.id,
      }));
    } else {
      await setSavedActiveWorkspaceId(null);
    }
  },

  createWorkspace: async (name, path) => {
    const api = getElectronAPI();
    if (!api) return;

    const result = await api.workspace.create({ name, path });
    if (result.success && result.data) {
      set((s) => ({
        workspaces: [result.data!, ...s.workspaces],
        activeWorkspaceId: result.data!.id,
      }));
      await setSavedActiveWorkspaceId(result.data!.id);
    }
  },

  deleteWorkspace: async (id) => {
    const api = getElectronAPI();
    if (!api) return;

    const result = await api.workspace.delete(id);
    if (result.success) {
      set((s) => {
        const isActive = s.activeWorkspaceId === id;
        if (isActive) setSavedActiveWorkspaceId(null);
        return {
          workspaces: s.workspaces.filter((w) => w.id !== id),
          activeWorkspaceId: isActive ? null : s.activeWorkspaceId,
        };
      });
    }
  },

  selectWorkspace: async (id) => {
    const api = getElectronAPI();
    if (!api) return;

    const result = await api.workspace.select(id);
    if (result.success && result.data) {
      set((s) => ({
        workspaces: s.workspaces.map((w) => (w.id === id ? result.data! : w)),
        activeWorkspaceId: result.data!.id,
      }));
      await setSavedActiveWorkspaceId(result.data!.id);
      // NOTE: agent store loading is handled by subscriber in app-layout.tsx
    }
  },

  clearActiveWorkspace: () => {
    setSavedActiveWorkspaceId(null);
    set({ activeWorkspaceId: null });
  },

  refreshGitInfo: async (id) => {
    const api = getElectronAPI();
    if (!api) return;
    const result = await api.workspace.refreshGit(id);
    if (result.success && result.data) {
      set((s) => ({
        workspaces: s.workspaces.map((w) => (w.id === id ? result.data! : w)),
      }));
    }
  },

  getGitBranches: async (id) => {
    const api = getElectronAPI();
    if (!api) return [];
    const result = await api.workspace.getBranches(id);
    return result.success && result.data ? result.data : [];
  },

  switchGitBranch: async (id, branchName) => {
    const api = getElectronAPI();
    if (!api) return;
    const result = await api.workspace.switchBranch(id, branchName);
    if (result.success && result.data) {
      set((s) => ({
        workspaces: s.workspaces.map((w) => (w.id === id ? result.data! : w)),
      }));
    }
  },

  createGitBranch: async (id, branchName) => {
    const api = getElectronAPI();
    if (!api) return;
    const result = await api.workspace.createBranch(id, branchName);
    if (result.success && result.data) {
      set((s) => ({
        workspaces: s.workspaces.map((w) => (w.id === id ? result.data! : w)),
      }));
    }
  },

  notifyFilesChanged: (workspaceId) => {
    set((s) => ({
      fileTreeVersions: {
        ...s.fileTreeVersions,
        [workspaceId]: (s.fileTreeVersions[workspaceId] ?? 0) + 1,
      },
    }));
  },

  notifyGitChanged: (workspaceId) => {
    set((s) => ({
      gitChangeVersions: {
        ...s.gitChangeVersions,
        [workspaceId]: (s.gitChangeVersions[workspaceId] ?? 0) + 1,
      },
    }));
  },
}));
```

---

## Step 4 — Delete Old Stores

Delete these two files:
- `apps/app/src/store/navigation.store.ts`
- `apps/app/src/store/create-branch-dialog.store.ts`

---

## Step 5 — Update `app-layout.tsx`

This is where the two stores are now coordinated via subscription instead of direct coupling. Add a `useEffect` that subscribes to `activeWorkspaceId` changes and calls `loadWorkspace` on the agent store.

Also update imports: replace `useNavigationStore` with `useUIStore`.

**Changes to make:**

1. Replace `import { useNavigationStore }` with `import { useUIStore }`
2. Replace `const { activeView, setActiveView, centerPage } = useNavigationStore()` with `const { activeView, setActiveView, centerPage } = useUIStore()`
3. Replace `activeWorkspace` selector with `activeWorkspaceId` + derived `getActiveWorkspace`
4. Add the store coordination subscription useEffect

```typescript
// In app-layout.tsx, add this useEffect for store coordination:
useEffect(() => {
  // When active workspace changes, load its agent history into memory.
  // This replaces the direct agent.store call that was in workspace.store.
  const unsubscribe = useWorkspaceStore.subscribe(
    (s) => s.activeWorkspaceId,
    (workspaceId) => {
      if (workspaceId) {
        useAgentStore.getState().loadWorkspace(workspaceId);
      }
    },
    { fireImmediately: true }
  );
  return unsubscribe;
}, []);
```

Also update how `activeWorkspace` is consumed — the store now exposes `activeWorkspaceId` (string) and `getActiveWorkspace()` (selector). Either pattern works for components:

```typescript
// Option A — subscribe to derived workspace object (re-renders on workspace field changes)
const activeWorkspace = useWorkspaceStore((s) =>
  s.workspaces.find((w) => w.id === s.activeWorkspaceId) ?? null
);

// Option B — subscribe to ID only (fewer re-renders), get object via selector
const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
const activeWorkspace = useWorkspaceStore.getState().getActiveWorkspace();
```

Use Option A in `app-layout.tsx` since it renders workspace-dependent UI.

---

## Step 6 — Update `agent-panel.tsx`

The panel must now pass `workspaceId` as the first argument to all agent store actions.

**Changes:**

1. Read `activeWorkspaceId` from workspace store, not the full `activeWorkspace` object
2. Pass `workspaceId` to all agent store calls: `startAgent`, `stopAgent`, `startNewThread`, `clearError`
3. Update selectors to use new `getActiveRuntime(workspaceId)` instead of `getThreadState(activeThreadId)`
4. Read `threads` and `activeThreadId` from `getWorkspaceState(workspaceId)`
5. Remove `totalCostUsd` prop to `ChatEditor` — have `ChatEditor` read from `useCostStore` directly
6. Remove `selectedModel`, `setSelectedModel`, `requireApproval`, `setRequireApproval` props to `ChatEditor` — have `ChatEditor` read from agent store directly

**Selector pattern after refactor:**

```typescript
// In AgentPanel:
const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
const activeWorkspace = useWorkspaceStore((s) =>
  s.workspaces.find((w) => w.id === s.activeWorkspaceId) ?? null
);

const runtime = useAgentStore((s) =>
  activeWorkspaceId ? s.getActiveRuntime(activeWorkspaceId) : null
);
const threadStatus = runtime?.status ?? "idle";
const threadError = runtime?.error ?? null;
const streamingText = runtime?.streamingText ?? "";

const activeThread = useAgentStore((s) =>
  activeWorkspaceId ? s.getActiveThread(activeWorkspaceId) : null
);
const threadMessages = activeThread?.messages ?? [];

// Actions
const startAgent = useAgentStore((s) => s.startAgent);
// Called as: startAgent(activeWorkspaceId!, prompt, options)

const stopAgent = useAgentStore((s) => s.stopAgent);
// Called as: stopAgent(activeWorkspaceId!)
```

---

## Step 7 — Update `message-list.tsx`

Scoped to the active workspace. Read messages from the thread directly (single source of truth now).

```typescript
// In MessageList, accept workspaceId as prop OR read from workspace store:
const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);

const messages = useAgentStore((s) => {
  if (!activeWorkspaceId) return [];
  return s.getActiveThread(activeWorkspaceId)?.messages ?? [];
});

const streamingText = useAgentStore((s) => {
  if (!activeWorkspaceId) return "";
  return s.getActiveRuntime(activeWorkspaceId).streamingText;
});
```

---

## Step 8 — Update `tool-approval-bar.tsx`

```typescript
const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);

const pendingApproval = useAgentStore((s) =>
  activeWorkspaceId ? s.getPendingToolApproval(activeWorkspaceId) : null
);

const respondToolApproval = useAgentStore((s) => s.respondToolApproval);
// Called as: respondToolApproval(activeWorkspaceId!, allow, message)
```

---

## Step 9 — Update `sidebar/index.tsx`

Replace status indicator — it reads from agent store for the active workspace:

```typescript
// Replace:
const status = useAgentStore((s) => s.getThreadState(s.activeThreadId).status);

// With:
const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
const status = useAgentStore((s) =>
  activeWorkspaceId ? s.getActiveRuntime(activeWorkspaceId).status : "idle"
);
```

Replace navigation store import:
```typescript
// Replace:
import { useNavigationStore } from "@/store/navigation.store";
const centerPage = useNavigationStore((s) => s.centerPage);
const setCenterPage = useNavigationStore((s) => s.setCenterPage);

// With:
import { useUIStore } from "@/store/ui.store";
const centerPage = useUIStore((s) => s.centerPage);
const setCenterPage = useUIStore((s) => s.setCenterPage);
```

---

## Step 10 — Update All Other Files Importing Old Stores

Run a global search for these import patterns and replace:

| Old import | New import |
|---|---|
| `from "@/store/navigation.store"` | `from "@/store/ui.store"` |
| `useNavigationStore` | `useUIStore` |
| `from "@/store/create-branch-dialog.store"` | `from "@/store/ui.store"` |
| `useCreateBranchDialogStore` | `useUIStore` |

For `fileTreeVersion` / `gitChangeVersion` consumers (e.g. `file-tree.tsx`, `git-changes-panel.tsx`):

```typescript
// Old
const fileTreeVersion = useWorkspaceStore((s) => s.fileTreeVersion);

// New — scoped to active workspace
const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
const fileTreeVersion = useWorkspaceStore((s) =>
  activeWorkspaceId ? (s.fileTreeVersions[activeWorkspaceId] ?? 0) : 0
);
```

---

## Step 11 — Clean Up `packages/shared/src/types.ts`

Remove dead fields to avoid confusion:

1. Remove `AgentSession` type (lines 27–34) — it was defined but never used. `ChatThread` serves this purpose.
2. Remove `activeSessionId?: string` from `Workspace` type (line 42) — never populated or read.
3. Remove `sdkSessionId?: string` from `ChatData` type (line 107) — stored on `ChatThread` instead.

---

## Step 12 — Backend: Add `workspaceId` to Tool Approval Events (Optional but Recommended)

In `apps/desktop/src/services/agent-manager.ts`, when emitting tool approval requests, include `workspaceId` in the payload so the frontend can route without scanning:

```typescript
// In agent-manager.ts, when emitting tool approval:
win.webContents.send(IPC_CHANNELS.AGENT_TOOL_APPROVAL_REQUEST, {
  ...approvalRequest,
  workspaceId,  // Add this
});
```

Update the `ToolApprovalRequest` type in `packages/shared/src/types.ts` to include optional `workspaceId`:

```typescript
export type ToolApprovalRequest = {
  requestId: string;
  toolName: string;
  input: unknown;
  sessionId?: string;
  workspaceId?: string;  // Add this
};
```

Same for `SdkSessionIdPayload`:

```typescript
export type SdkSessionIdPayload = {
  sdkSessionId: string;
  threadId: string;
  workspaceId?: string;  // Add this
};
```

---

## Verification Checklist

After completing all steps, verify:

- [ ] Two workspaces can run agents simultaneously without interfering
- [ ] Streaming text in workspace A does not affect workspace B's UI
- [ ] Switching workspaces while an agent is running in another workspace preserves the running agent's state
- [ ] Tool approval for workspace A appears only in workspace A's UI
- [ ] Thread list loads correctly when switching between workspaces
- [ ] Creating a new thread in one workspace does not affect another workspace
- [ ] Deleting a workspace cleans up its state from `agent.store.workspaces`
- [ ] Persisting history saves correct data per workspace
- [ ] No TypeScript errors from removed fields (`AgentSession`, `activeSessionId`)
- [ ] `fileTreeVersion` change in workspace A does not trigger re-render of workspace B's file tree
- [ ] `useNavigationStore` and `useCreateBranchDialogStore` have zero remaining references (search codebase)

---

## What Was NOT Changed

- `cost.store.ts` — global cost tracking is intentional, no change needed
- `file-context.store.ts` — handler registration pattern is acceptable for this use case
- `terminal.store.ts` — terminal sessions are not workspace-scoped by design
- All IPC channel names — no backend protocol changes required except optional `workspaceId` in tool approval events
- localStorage key format — `agentide-chat-{workspaceId}` remains the same, data is compatible
- Electron chat storage API — `api.chat.load(workspaceId)` / `api.chat.save(workspaceId, data)` interface unchanged

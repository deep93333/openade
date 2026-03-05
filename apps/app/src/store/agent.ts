import type {
  AgentMessage,
  AgentMode,
  AgentProvider,
  AgentResult,
  AgentStatus,
  ChatData,
  ChatThread,
  Checkpoint,
  ImageAttachment,
  TaskStatus,
  ToolApprovalRequest,
} from "@agentide/shared";
import { create } from "zustand";
import { getProviderForModel } from "@agentide/shared";
import { getToolTitle } from "@/components/agent/tools/labels";
import { getElectronAPI } from "@/lib/electron";
import { normalizeUserMessageContentToText } from "@/utils/message";
import { useCostStore } from "./cost";

const CHAT_STORAGE_KEY = "agentide-chat";
const MODEL_STORAGE_KEY = "agentide-selected-model";
const PROVIDER_STORAGE_KEY = "agentide-selected-provider";
const DEFAULT_MODEL = "claude-sonnet-4-20250514";

type ThreadRuntime = {
  status: AgentStatus;
  error: string | null;
  streamingText: string;
  streamingCommittedPrefix: string;
  sessionId: string | null;
  activeToolCalls: AgentMessage[];
  lastCompletedActivity: string | null;
};

const EMPTY_RUNTIME: ThreadRuntime = {
  status: "idle",
  error: null,
  streamingText: "",
  streamingCommittedPrefix: "",
  sessionId: null,
  activeToolCalls: [],
  lastCompletedActivity: null,
};

type WorkspaceAgentState = {
  threads: ChatThread[];
  activeThreadId: string;
  threadRuntime: Record<string, ThreadRuntime>;
  sessionToThread: Record<string, string>;
};

const EMPTY_WORKSPACE_STATE: WorkspaceAgentState = {
  threads: [],
  activeThreadId: "",
  threadRuntime: {},
  sessionToThread: {},
};

type AgentStoreState = {
  workspaces: Record<string, WorkspaceAgentState>;
  selectedModel: string;
  selectedProvider: AgentProvider;
  selectedMode: AgentMode;
  requireApproval: boolean;
  pendingToolApprovals: Record<string, ToolApprovalRequest | null>;
  sessionAllowedTools: Set<string>;
  listenersInitialized: boolean;
  listenersCleanup: (() => void) | null;

  loadWorkspace: (workspaceId: string) => Promise<void>;
  unloadWorkspace: (workspaceId: string) => void;
  persistWorkspace: (workspaceId: string) => Promise<void>;

  startNewThread: (workspaceId: string) => Promise<void>;
  createTaskThread: (
    workspaceId: string,
    content: string,
    displayContent?: string,
    model?: string,
    provider?: AgentProvider
  ) => Promise<string | null>;
  createBrainstormThread: (workspaceId: string) => Promise<string>;
  switchThread: (workspaceId: string, threadId: string) => void;
  deleteThread: (workspaceId: string, threadId: string) => Promise<void>;
  updateThreadTaskStatus: (workspaceId: string, threadId: string, taskStatus: TaskStatus) => Promise<void>;
  generateThreadTitle: (workspaceId: string, threadId: string) => Promise<void>;

  startAgent: (
    workspaceId: string,
    prompt: string,
    options?: {
      displayContent?: string;
      imageAttachments?: ImageAttachment[];
      provider?: AgentProvider;
      useExistingPrompt?: boolean;
      threadId?: string;
      mode?: AgentMode;
    }
  ) => Promise<void>;
  buildFromPlan: (workspaceId: string, planContent: string) => Promise<void>;
  stopAgent: (workspaceId: string) => Promise<void>;

  addMessage: (message: AgentMessage) => void;
  setResult: (result: AgentResult) => void;
  setError: (payload: { sessionId: string; error: string; workspaceId?: string }) => void;

  setPendingToolApproval: (workspaceId: string, request: ToolApprovalRequest | null) => void;
  respondToolApproval: (
    workspaceId: string,
    allow: boolean,
    message?: string,
    updatedInput?: unknown
  ) => Promise<void>;
  allowToolForSession: (workspaceId: string, toolName: string) => Promise<void>;
  clearSessionAllowedTools: () => void;
  clearError: (workspaceId: string) => void;

  setSelectedModel: (model: string) => void;
  setSelectedProvider: (provider: AgentProvider) => void;
  setSelectedMode: (mode: AgentMode) => void;
  setRequireApproval: (value: boolean) => void;

  createCheckpoint: (workspaceId: string) => Promise<Checkpoint | null>;
  rewindToCheckpoint: (
    workspaceId: string,
    checkpointId: string,
    mode: "both" | "conversation" | "code"
  ) => Promise<void>;

  getWorkspaceState: (workspaceId: string) => WorkspaceAgentState;
  getActiveThread: (workspaceId: string) => ChatThread | null;
  getActiveRuntime: (workspaceId: string) => ThreadRuntime;
  getThreadRuntime: (workspaceId: string, threadId: string) => ThreadRuntime;
  getPendingToolApproval: (workspaceId: string) => ToolApprovalRequest | null;

  initListeners: () => void;
  teardownListeners: () => void;
};

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
    //
  }
};

const loadSelectedModel = (): string => {
  try {
    const model = localStorage.getItem(MODEL_STORAGE_KEY);
    return model && model.trim().length > 0 ? model : DEFAULT_MODEL;
  } catch {
    return DEFAULT_MODEL;
  }
};

const saveSelectedModel = (model: string): void => {
  try {
    localStorage.setItem(MODEL_STORAGE_KEY, model);
  } catch {
    //
  }
};

const loadSelectedProvider = (): AgentProvider => {
  try {
    const p = localStorage.getItem(PROVIDER_STORAGE_KEY);
    return p === "codex" ? "codex" : "claude";
  } catch {
    return "claude";
  }
};

const saveSelectedProvider = (provider: AgentProvider): void => {
  try {
    localStorage.setItem(PROVIDER_STORAGE_KEY, provider);
  } catch {
    //
  }
};

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

export const useAgentStore = create<AgentStoreState>()((set, get) => ({
  workspaces: {},
  selectedModel: loadSelectedModel(),
  selectedProvider: loadSelectedProvider(),
  selectedMode: "agent",
  requireApproval: true,
  pendingToolApprovals: {},
  sessionAllowedTools: new Set<string>(),
  listenersInitialized: false,
  listenersCleanup: null,

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

  loadWorkspace: async (workspaceId) => {
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

  startNewThread: async (workspaceId) => {
    const threadId = crypto.randomUUID();
    const newThread: ChatThread = {
      id: threadId,
      messages: [],
      createdAt: Date.now(),
      taskStatus: "backlog",
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

  createBrainstormThread: async (workspaceId) => {
    const threadId = crypto.randomUUID();
    const newThread: ChatThread = {
      id: threadId,
      messages: [],
      createdAt: Date.now(),
      taskStatus: "brainstorm",
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
    return threadId;
  },

  createTaskThread: async (workspaceId, content, displayContent, model, provider) => {
    const trimmed = content.trim();
    if (!trimmed) return null;

    const threadId = crypto.randomUUID();
    const userMessage: AgentMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: displayContent ?? trimmed,
      timestamp: Date.now(),
    };

    set((s) => {
      const ws = s.workspaces[workspaceId] ?? EMPTY_WORKSPACE_STATE;
      const newThread: ChatThread = {
        id: threadId,
        messages: [userMessage],
        createdAt: Date.now(),
        taskStatus: "backlog",
        ...(model && { model }),
        ...(provider && { provider }),
      };

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
    return threadId;
  },

  switchThread: (workspaceId, threadId) => {
    set((s) => {
      const ws = s.workspaces[workspaceId];
      if (!ws) return s;
      const thread = ws.threads.find((t) => t.id === threadId);
      if (!thread) return s;
      const runtime = ws.threadRuntime[threadId] ?? { ...EMPTY_RUNTIME };
      const provider = thread.provider ?? s.selectedProvider;
      return {
        workspaces: {
          ...s.workspaces,
          [workspaceId]: {
            ...ws,
            activeThreadId: threadId,
            threadRuntime: { ...ws.threadRuntime, [threadId]: runtime },
          },
        },
        selectedProvider: provider,
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

  updateThreadTaskStatus: async (workspaceId, threadId, taskStatus) => {
    let prevStatus: TaskStatus | undefined;
    set((s) => {
      const ws = s.workspaces[workspaceId];
      if (!ws) return s;
      const thread = ws.threads.find((t) => t.id === threadId);
      prevStatus = thread?.taskStatus ?? "backlog";

      const updatedThreads = ws.threads.map((t) =>
        t.id === threadId ? { ...t, taskStatus } : t
      );

      return {
        ...s,
        workspaces: {
          ...s.workspaces,
          [workspaceId]: {
            ...ws,
            threads: updatedThreads,
          },
        },
      };
    });

    const updatedData = get().workspaces[workspaceId];
    if (updatedData) {
      const api = getElectronAPI();
      if (api?.chat) {
        await api.chat.save(workspaceId, {
          threads: updatedData.threads,
          activeThreadId: updatedData.activeThreadId,
        }).catch(console.error);
      } else {
        saveToLocalStorage(workspaceId, {
          threads: updatedData.threads,
          activeThreadId: updatedData.activeThreadId,
        });
      }
    }

    if (taskStatus === "brainstorm") {
      const ws = get().workspaces[workspaceId];
      const thread = ws?.threads.find((t) => t.id === threadId);
      const runtime = ws?.threadRuntime[threadId];
      const isAlreadyRunning = runtime?.status === "running" && !!runtime?.sessionId;
      const hasUserMessage = thread?.messages.some(
        (m) => m.role === "user" && normalizeUserMessageContentToText(m.content).trim()
      );
      if (thread && hasUserMessage && !isAlreadyRunning) {
        const prevMode = get().selectedMode;
        set({ selectedMode: "ask" });
        await get().startAgent(workspaceId, "", {
          useExistingPrompt: true,
          threadId,
        });
        set({ selectedMode: prevMode });
      }
    }

    if (taskStatus === "planning" && prevStatus === "backlog") {
      const ws = get().workspaces[workspaceId];
      const thread = ws?.threads.find((t) => t.id === threadId);
      const runtime = ws?.threadRuntime[threadId];
      const isAlreadyRunning = runtime?.status === "running" && !!runtime?.sessionId;
      const hasUserMessage = thread?.messages.some(
        (m) => m.role === "user" && normalizeUserMessageContentToText(m.content).trim()
      );
      if (thread && hasUserMessage && !isAlreadyRunning) {
        const prevMode = get().selectedMode;
        set({ selectedMode: "plan" });
        await get().startAgent(workspaceId, "", {
          useExistingPrompt: true,
          threadId,
        });
        set({ selectedMode: prevMode });
      }
    }

    if (taskStatus === "in_progress" && prevStatus === "planning") {
      const ws = get().workspaces[workspaceId];
      const thread = ws?.threads.find((t) => t.id === threadId);
      const runtime = ws?.threadRuntime[threadId];
      const isAlreadyRunning = runtime?.status === "running" && !!runtime?.sessionId;
      if (thread && !isAlreadyRunning) {
        const planMessage = [...thread.messages].reverse().find(
          (m) => m.role === "assistant" && m.planContent
        );
        if (planMessage?.planContent) {
          await get().buildFromPlan(workspaceId, planMessage.planContent);
        } else {
          const hasUserMessage = thread.messages.some(
            (m) => m.role === "user" && normalizeUserMessageContentToText(m.content).trim()
          );
          if (hasUserMessage) {
            await get().startAgent(workspaceId, "", {
              useExistingPrompt: true,
              threadId,
            });
          }
        }
      }
    }

    if (taskStatus === "in_progress" && prevStatus === "backlog") {
      const ws = get().workspaces[workspaceId];
      const thread = ws?.threads.find((t) => t.id === threadId);
      const runtime = ws?.threadRuntime[threadId];
      const isAlreadyRunning = runtime?.status === "running" && !!runtime?.sessionId;
      const hasUserMessage = thread?.messages.some(
        (m) => m.role === "user" && normalizeUserMessageContentToText(m.content).trim()
      );
      if (thread && hasUserMessage && !isAlreadyRunning) {
        await get().startAgent(workspaceId, "", {
          useExistingPrompt: true,
          threadId,
        });
      }
    }

    if (taskStatus === "agent_review") {
      const ws = get().workspaces[workspaceId];
      const thread = ws?.threads.find((t) => t.id === threadId);
      const runtime = ws?.threadRuntime[threadId];
      const isAlreadyRunning = runtime?.status === "running" && !!runtime?.sessionId;
      if (thread && !isAlreadyRunning) {
        const reviewPrompt =
          "Please review the work done in this thread. Run readlints on any changed files. " +
          "Check for correctness, completeness, type safety, and edge cases. " +
          "Summarise findings and suggest concrete improvements.";
        await get().startAgent(workspaceId, reviewPrompt, {
          threadId,
          mode: "agent_review",
        });
      }
    }
  },

  generateThreadTitle: async (workspaceId, threadId) => {
    const ws = get().workspaces[workspaceId];
    const thread = ws?.threads.find((t) => t.id === threadId);
    if (!ws || !thread || thread.title?.trim()) return;

    const firstUser = thread.messages.find((message) =>
      message.role === "user" && message.content.trim()
    );
    if (!firstUser) return;

    const lastAssistant = [...thread.messages]
      .reverse()
      .find((message) => message.role === "assistant" && message.content.trim());

    const api = getElectronAPI();
    if (!api?.agent?.generateThreadTitle) return;

    const result = await api.agent.generateThreadTitle({
      messages: lastAssistant ? [firstUser, lastAssistant] : [firstUser],
      model: get().selectedModel,
      provider: thread.provider ?? get().selectedProvider,
    });
    const title = result.success && result.data ? result.data.trim() : "";
    if (!title) return;

    set((s) => {
      const ws = s.workspaces[workspaceId];
      if (!ws) return s;
      return {
        workspaces: {
          ...s.workspaces,
          [workspaceId]: {
            ...ws,
            threads: ws.threads.map((t) =>
              t.id === threadId && !t.title?.trim() ? { ...t, title } : t
            ),
          },
        },
      };
    });

    await get().persistWorkspace(workspaceId);
  },

  startAgent: async (workspaceId, prompt, options) => {
    const api = getElectronAPI();
    if (!api) return;

    const { selectedModel, selectedMode, requireApproval, createCheckpoint } = get();
    const ws = get().workspaces[workspaceId];
    if (!ws) return;

    const tid = options?.threadId ?? ws.activeThreadId;
    const targetThread = ws.threads.find((t) => t.id === tid);
    if (!targetThread) return;

    // Brainstorm threads always run in ask mode (no tools).
    // Explicit mode option from caller takes precedence over selectedMode.
    const effectiveMode: AgentMode =
      targetThread.taskStatus === "brainstorm"
        ? "ask"
        : (options?.mode ?? selectedMode);

    const useExistingPrompt = options?.useExistingPrompt ?? false;
    const isRepromptFromReview =
      (targetThread.taskStatus ?? "backlog") === "in_review";

    if (isRepromptFromReview) {
      set((s) => {
        const w = s.workspaces[workspaceId];
        if (!w) return s;
        return {
          workspaces: {
            ...s.workspaces,
            [workspaceId]: {
              ...w,
              threads: w.threads.map((t) =>
                t.id === tid ? { ...t, taskStatus: "in_progress" as TaskStatus } : t
              ),
            },
          },
        };
      });
      get().persistWorkspace(workspaceId).catch(() => {});
    }

    set((s) => {
      const w = s.workspaces[workspaceId];
      if (!w) return s;
      const next = { ...w, activeThreadId: tid };
      return { workspaces: { ...s.workspaces, [workspaceId]: next } };
    });

    await createCheckpoint(workspaceId);

    const images = options?.imageAttachments?.length ? options.imageAttachments : undefined;
    let resolvedPrompt = prompt;
    let existingMessages: AgentMessage[] = [];
    let skipAddingMessage = false;

    if (useExistingPrompt) {
      const lastUser = [...targetThread.messages].reverse().find((m) => m.role === "user");
      if (!lastUser || !normalizeUserMessageContentToText(lastUser.content).trim()) return;
      resolvedPrompt = normalizeUserMessageContentToText(lastUser.content);
      const lastIdx = targetThread.messages.findIndex((m) => m.id === lastUser.id);
      existingMessages = targetThread.messages.slice(0, lastIdx).map((m) =>
        m.role === "user" ? { ...m, content: normalizeUserMessageContentToText(m.content) } : m
      );
      skipAddingMessage = true;
    }

    const userMessage: AgentMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: options?.displayContent ?? resolvedPrompt,
      timestamp: Date.now(),
      imageAttachments: images,
    };

    const shouldGenerateTitle =
      !skipAddingMessage && !targetThread.title?.trim() && targetThread.messages.length === 0;

    if (!skipAddingMessage) {
      set((s) => {
        const w = s.workspaces[workspaceId];
        if (!w) return s;
        const thread = w.threads.find((t) => t.id === tid);
        if (!thread) return s;
        const updatedThread = { ...thread, messages: [...thread.messages, userMessage] };
        return {
          workspaces: {
            ...s.workspaces,
            [workspaceId]: {
              ...w,
              threads: w.threads.map((t) => (t.id === tid ? updatedThread : t)),
              threadRuntime: {
                ...w.threadRuntime,
                [tid]: { ...EMPTY_RUNTIME, status: "running" },
              },
            },
          },
        };
      });

      if (shouldGenerateTitle) {
        void get().generateThreadTitle(workspaceId, tid);
      }
    } else {
      set((s) => {
        const w = s.workspaces[workspaceId];
        if (!w) return s;
        return {
          workspaces: {
            ...s.workspaces,
            [workspaceId]: {
              ...w,
              threadRuntime: {
                ...w.threadRuntime,
                [tid]: { ...EMPTY_RUNTIME, status: "running" },
              },
            },
          },
        };
      });
    }

    const activeThread = get().workspaces[workspaceId]?.threads.find((t) => t.id === tid);
    const resumeSessionId = activeThread?.sdkSessionId;
    const isTaskThread = options?.useExistingPrompt && activeThread?.model;
    const modelToUse = isTaskThread ? activeThread.model : selectedModel;
    const provider =
      getProviderForModel(modelToUse) ??
      options?.provider ??
      activeThread?.provider ??
      get().selectedProvider;

    const messagesForApi =
      skipAddingMessage
        ? existingMessages
        : (activeThread?.messages.slice(0, -1).map((m) =>
            m.role === "user" ? { ...m, content: normalizeUserMessageContentToText(m.content) } : m
          ) ?? []);

    const result = await api.agent.start({
      prompt: resolvedPrompt,
      workspaceId,
      activeThreadId: tid || undefined,
      existingMessages: messagesForApi,
      model: modelToUse,
      mode: effectiveMode,
      provider,
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

  buildFromPlan: async (workspaceId, planContent) => {
    const prompt = `Execute the following implementation plan step by step. Follow each step precisely, reading the relevant files first before making changes.\n\n---\n${planContent}\n---\n\nBegin implementing the plan now.`;
    set({ selectedMode: "agent" });
    await get().startAgent(workspaceId, prompt);
  },

  stopAgent: async (workspaceId) => {
    const api = getElectronAPI();
    const ws = get().workspaces[workspaceId];
    if (!api || !ws) return;

    const activeRuntime = ws.threadRuntime[ws.activeThreadId];
    const activeIsRunning = activeRuntime?.status === "running" && !!activeRuntime.sessionId;
    const fallback = Object.entries(ws.threadRuntime).find(
      ([, runtime]) => runtime.status === "running" && !!runtime.sessionId
    );

    const targetThreadId = activeIsRunning ? ws.activeThreadId : (fallback?.[0] ?? null);
    const sessionId = activeIsRunning
      ? activeRuntime?.sessionId ?? null
      : (fallback?.[1].sessionId ?? null);
    if (!targetThreadId || !sessionId) return;

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
              [targetThreadId]: { ...EMPTY_RUNTIME, status: "stopped" },
            },
          },
        },
      };
    });
  },

  addMessage: (message) => {
    const { workspaces } = get();

    let targetWorkspaceId: string | null = null;
    let targetThreadId: string | null = null;

    if (message.sessionId) {
      targetWorkspaceId = findWorkspaceForSession(workspaces, message.sessionId);
      targetThreadId = targetWorkspaceId
        ? workspaces[targetWorkspaceId].sessionToThread[message.sessionId]
        : null;
    } else {
      for (const [wsId, wsState] of Object.entries(workspaces)) {
        targetWorkspaceId = wsId;
        targetThreadId = wsState.activeThreadId;
        break;
      }
    }

    if (!targetWorkspaceId || !targetThreadId) return;
    const wsId = targetWorkspaceId;
    const threadId = targetThreadId;

    if (message.isPartial) {
      set((s) => {
        const ws = s.workspaces[wsId];
        if (!ws) return s;
        const runtime = ws.threadRuntime[threadId] ?? EMPTY_RUNTIME;
        const raw = typeof message.content === "string" ? message.content : String(message.content ?? "");
        const prefix = runtime.streamingCommittedPrefix;
        const text = prefix && raw.startsWith(prefix) ? raw.slice(prefix.length) : raw;
        return {
          workspaces: {
            ...s.workspaces,
            [wsId]: {
              ...ws,
              threadRuntime: {
                ...ws.threadRuntime,
                [threadId]: {
                  ...runtime,
                  streamingText: text,
                },
              },
            },
          },
        };
      });
      return;
    }

    if (message.role === "tool" && message.toolStatus === "running") {
      set((s) => {
        const ws = s.workspaces[wsId];
        if (!ws) return s;
        const runtime = ws.threadRuntime[threadId] ?? EMPTY_RUNTIME;
        let nextStreamingText = runtime.streamingText;
        let nextCommittedPrefix = runtime.streamingCommittedPrefix;
        const messagesToAdd: AgentMessage[] = [];

        if (runtime.streamingText) {
          messagesToAdd.push({
            id: `${message.id}-assistant-before`,
            role: "assistant",
            content: runtime.streamingText,
            timestamp: message.timestamp - 1,
          });
          nextCommittedPrefix = runtime.streamingCommittedPrefix + runtime.streamingText;
          nextStreamingText = "";
        }

        const updatedThreads = messagesToAdd.length > 0
          ? ws.threads.map((t) =>
              t.id === threadId
                ? { ...t, messages: [...t.messages, ...messagesToAdd] }
                : t
            )
          : ws.threads;

        return {
          workspaces: {
            ...s.workspaces,
            [wsId]: {
              ...ws,
              threads: updatedThreads,
              threadRuntime: {
                ...ws.threadRuntime,
                [threadId]: {
                  ...runtime,
                  streamingText: nextStreamingText,
                  streamingCommittedPrefix: nextCommittedPrefix,
                  activeToolCalls: [...runtime.activeToolCalls, message],
                },
              },
            },
          },
        };
      });

      // Generate title during run when first tool starts - gives context about what agent is doing
      const currentWs = get().workspaces[wsId];
      const currentThread = currentWs?.threads.find((t) => t.id === threadId);
      if (currentThread && !currentThread.title?.trim() && message.toolName) {
        const titleContext: AgentMessage[] = [];
        const firstUser = currentThread.messages.find((m) => m.role === "user" && m.content.trim());
        if (firstUser) {
          titleContext.push(firstUser);
        }
        // Include tool info in context for better title generation
        const toolContextMessage: AgentMessage = {
          id: `${message.id}-tool-context`,
          role: "tool" as const,
          content: `Starting tool: ${message.toolName}`,
          timestamp: message.timestamp,
          toolName: message.toolName,
          toolInput: message.toolInput,
          toolCallId: message.toolCallId,
          toolStatus: "running",
        };
        titleContext.push(toolContextMessage);

        const api = getElectronAPI();
        if (api?.agent?.generateThreadTitle) {
          const model = currentThread.model ?? get().selectedModel;
          const provider = currentThread.provider ?? get().selectedProvider;
          api.agent
            .generateThreadTitle({ messages: titleContext, model, provider })
            .then((result) => {
              if (result.success && result.data) {
                const title = result.data.trim();
                if (title) {
                  set((s) => {
                    const ws = s.workspaces[wsId];
                    if (!ws) return s;
                    return {
                      workspaces: {
                        ...s.workspaces,
                        [wsId]: {
                          ...ws,
                          threads: ws.threads.map((t) =>
                            t.id === threadId && !t.title?.trim() ? { ...t, title } : t
                          ),
                        },
                      },
                    };
                  });
                  get().persistWorkspace(wsId).catch(() => {});
                }
              }
            })
            .catch(() => {});
        }
      }
      return;
    }

    set((s) => {
      const ws = s.workspaces[wsId];
      if (!ws) return s;
      const runtime = ws.threadRuntime[threadId] ?? EMPTY_RUNTIME;

      let messagesToAdd: AgentMessage[] = [];
      let streamingTextToClear = runtime.streamingText;
      let streamingCommittedPrefixUpdate: string | null = null;
      let nextActiveToolCalls = runtime.activeToolCalls;
      let nextLastCompletedActivity: string | null = runtime.lastCompletedActivity ?? null;

      if (message.role === "tool") {
        if (runtime.streamingText) {
          messagesToAdd.push({
            id: `${message.id}-assistant-before`,
            role: "assistant",
            content: runtime.streamingText,
            timestamp: message.timestamp - 1,
          });
        }
        messagesToAdd.push({ ...message, content: message.content });
        streamingTextToClear = "";
        streamingCommittedPrefixUpdate = runtime.streamingCommittedPrefix + runtime.streamingText;
        if (message.toolCallId) {
          nextActiveToolCalls = runtime.activeToolCalls.filter(
            (tc) => tc.toolCallId !== message.toolCallId
          );
        }
        nextLastCompletedActivity = getToolTitle(
          message.toolName,
          (message.toolInput ?? {}) as Record<string, unknown>,
          false
        );
      } else if (message.role === "assistant") {
        const finalContent = runtime.streamingText || message.content;
        messagesToAdd.push({ ...message, content: finalContent });
        streamingTextToClear = "";
        streamingCommittedPrefixUpdate = runtime.streamingCommittedPrefix + finalContent;
      } else {
        messagesToAdd.push({ ...message, content: message.content });
        if (message.role === "system") {
          streamingTextToClear = "";
          streamingCommittedPrefixUpdate = "";
        }
      }

      const updatedThreads = ws.threads.map((t) =>
        t.id === threadId
          ? { ...t, messages: [...t.messages, ...messagesToAdd] }
          : t
      );
      const shouldCleanupSession =
        !!message.sessionId &&
        runtime.status !== "running" &&
        runtime.sessionId === message.sessionId;
      const nextSessionToThread = shouldCleanupSession
        ? (() => {
            const next = { ...ws.sessionToThread };
            delete next[message.sessionId!];
            return next;
          })()
        : ws.sessionToThread;
      return {
        workspaces: {
          ...s.workspaces,
          [wsId]: {
            ...ws,
            threads: updatedThreads,
            sessionToThread: nextSessionToThread,
            threadRuntime: {
                ...ws.threadRuntime,
                [threadId]: {
                  ...runtime,
                  streamingText: streamingTextToClear,
                  streamingCommittedPrefix:
                    streamingCommittedPrefixUpdate ?? runtime.streamingCommittedPrefix,
                  activeToolCalls: nextActiveToolCalls,
                  lastCompletedActivity: nextLastCompletedActivity,
                  ...(shouldCleanupSession ? { sessionId: null, streamingCommittedPrefix: "", activeToolCalls: [], lastCompletedActivity: null } : {}),
                },
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
    const targetWorkspaceId = findWorkspaceForSession(workspaces, result.sessionId);
    if (!targetWorkspaceId) return;
    const wsId = targetWorkspaceId;
    const threadId = workspaces[wsId].sessionToThread[result.sessionId];

    const inputTokens = result.inputTokens ?? 0;
    const outputTokens = result.outputTokens ?? 0;
    const costUsd = result.totalCostUsd ?? 0;
    const hasUsage = inputTokens > 0 || outputTokens > 0 || costUsd > 0;

    set((s) => {
      const ws = s.workspaces[wsId];
      if (!ws) return s;
      const prevRuntime = ws.threadRuntime[threadId] ?? EMPTY_RUNTIME;
      const prevThread = ws.threads.find((t) => t.id === threadId);
      const currentStatus = prevThread?.taskStatus ?? "backlog";
      const moveToReview =
        result.success && currentStatus === "in_progress";
      const threadTokenUpdate =
        inputTokens > 0 || outputTokens > 0
          ? {
              inputTokens: (prevThread?.inputTokens ?? 0) + inputTokens,
              outputTokens: (prevThread?.outputTokens ?? 0) + outputTokens,
              lastRunInputTokens: inputTokens,
              lastRunOutputTokens: outputTokens,
            }
          : {};
      return {
        workspaces: {
          ...s.workspaces,
          [wsId]: {
            ...ws,
            threads: ws.threads.map((t) =>
              t.id === threadId
                ? {
                    ...t,
                    ...threadTokenUpdate,
                    ...(moveToReview ? { taskStatus: "in_review" as TaskStatus } : {}),
                    ...(hasUsage && t.messages.length > 0
                      ? {
                          messages: t.messages.map((msg, i) =>
                            i === t.messages.length - 1
                              ? {
                                  ...msg,
                                  inputTokens: (msg.inputTokens ?? 0) + inputTokens,
                                  outputTokens: (msg.outputTokens ?? 0) + outputTokens,
                                  costUsd: (msg.costUsd ?? 0) + costUsd,
                                }
                              : msg
                          ),
                        }
                      : {}),
                  }
                : t
            ),
            threadRuntime: {
              ...ws.threadRuntime,
              [threadId]: {
                ...prevRuntime,
                status: result.success ? "idle" : "error",
                error: result.error || null,
                activeToolCalls: [],
                streamingText: "",
                streamingCommittedPrefix: "",
              },
            },
          },
        },
      };
    });

    get().persistWorkspace(wsId).catch(() => {});

    const api = getElectronAPI();
    if (api?.checkpoint && result.success) {
      api.checkpoint.finalize({ workspaceId: wsId, threadId }).then((res) => {
        if (!res.success || !res.data) return;
        const { checkpointId, modifiedFiles, createdFiles } = res.data;
        set((s) => {
          const ws = s.workspaces[wsId];
          if (!ws) return s;
          return {
            workspaces: {
              ...s.workspaces,
              [wsId]: {
                ...ws,
                threads: ws.threads.map((t) =>
                  t.id === threadId
                    ? {
                        ...t,
                        checkpoints: (t.checkpoints ?? []).map((c) =>
                          c.id === checkpointId
                            ? { ...c, modifiedFiles, createdFiles }
                            : c
                        ),
                      }
                    : t
                ),
              },
            },
          };
        });
      }).catch(() => {});
    }
  },

  setError: (payload) => {
    const { workspaces } = get();
    let wsId: string | null = null;
    let threadId: string | null = null;

    if (payload.workspaceId) {
      wsId = payload.workspaceId;
      const ws = workspaces[wsId];
      threadId = ws?.activeThreadId ?? null;
    } else if (payload.sessionId) {
      wsId = findWorkspaceForSession(workspaces, payload.sessionId);
      threadId = wsId ? workspaces[wsId].sessionToThread[payload.sessionId] : null;
    }

    if (!wsId || !threadId) return;
    const resolvedWorkspaceId = wsId;
    const resolvedThreadId = threadId;
    const errorStr =
      typeof payload.error === "string"
        ? payload.error
        : payload.error && typeof payload.error === "object"
          ? (payload.error as { message?: string }).message ?? JSON.stringify(payload.error)
          : String(payload.error ?? "Unknown error");

    set((s) => {
      const ws = s.workspaces[resolvedWorkspaceId];
      if (!ws) return s;
      let nextSessionToThread = ws.sessionToThread;
      if (payload.sessionId && ws.sessionToThread[payload.sessionId]) {
        nextSessionToThread = { ...ws.sessionToThread };
        delete nextSessionToThread[payload.sessionId];
      }
      return {
        workspaces: {
          ...s.workspaces,
          [resolvedWorkspaceId]: {
            ...ws,
            sessionToThread: nextSessionToThread,
            threadRuntime: {
              ...ws.threadRuntime,
              [resolvedThreadId]: {
                ...(ws.threadRuntime[resolvedThreadId] ?? EMPTY_RUNTIME),
                status: "error",
                error: errorStr,
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

  setPendingToolApproval: (workspaceId, request) => {
    set((s) => ({
      pendingToolApprovals: { ...s.pendingToolApprovals, [workspaceId]: request },
    }));
  },

  respondToolApproval: async (workspaceId, allow, message, updatedInput) => {
    const api = getElectronAPI();
    const request = get().pendingToolApprovals[workspaceId];
    if (!api || !request) return;
    await api.agent.respondToolApproval({
      requestId: request.requestId,
      allow,
      updatedInput: allow ? updatedInput : undefined,
      message: allow ? undefined : message ?? "Denied by user",
    });
    set((s) => ({
      pendingToolApprovals: { ...s.pendingToolApprovals, [workspaceId]: null },
    }));
  },

  allowToolForSession: async (workspaceId, toolName) => {
    set((s) => ({
      sessionAllowedTools: new Set([...s.sessionAllowedTools, toolName]),
    }));
    await get().respondToolApproval(workspaceId, true);
  },

  clearSessionAllowedTools: () => set({ sessionAllowedTools: new Set() }),

  setSelectedModel: (model) => {
    saveSelectedModel(model);
    set({ selectedModel: model });
  },
  setSelectedProvider: (provider) => {
    saveSelectedProvider(provider);
    set({ selectedProvider: provider });
  },
  setSelectedMode: (mode) => set({ selectedMode: mode }),
  setRequireApproval: (value) => set({ requireApproval: value }),

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

    const { checkpoint, finalizedPrev } = result.data;
    if (!checkpoint) return null;
    set((s) => {
      const ws = s.workspaces[workspaceId];
      if (!ws) return s;
      return {
        workspaces: {
          ...s.workspaces,
          [workspaceId]: {
            ...ws,
            threads: ws.threads.map((t) => {
              if (t.id !== ws.activeThreadId) return t;
              const updatedCheckpoints = (t.checkpoints ?? []).map((c) =>
                finalizedPrev && c.id === finalizedPrev.id ? finalizedPrev : c
              );
              return { ...t, checkpoints: [...updatedCheckpoints, checkpoint] };
            }),
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

    if (doCode && api?.checkpoint) {
      const result = await api.checkpoint.restore({
        workspaceId,
        stashRef: checkpoint.gitStashRef ?? null,
        modifiedFiles: checkpoint.modifiedFiles,
        createdFiles: checkpoint.createdFiles,
      });
      if (!result.success) {
        get().setError({
          sessionId: "",
          error: result.error ?? "Failed to restore code",
          workspaceId,
        });
        if (mode === "both") return;
      }
    }

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
                [ws.activeThreadId]: { ...EMPTY_RUNTIME },
              },
            },
          },
        };
      });
      await get().persistWorkspace(workspaceId);
    }
  },

  initListeners: () => {
    if (get().listenersInitialized) return;
    const api = getElectronAPI();
    if (!api) return;

    const removeMessage = api.agent.onMessage((message) => {
      get().addMessage(message);
    });

    const removeResult = api.agent.onResult((result) => {
      get().setResult(result);
    });

    const removeError = api.agent.onError((payload: { sessionId: string; error: string }) => {
      get().setError(payload);
    });

    const removeToolApproval = api.agent.onToolApprovalRequest?.(
      (request: ToolApprovalRequest & { workspaceId?: string }) => {
        const workspaceId =
          request.workspaceId ?? findWorkspaceForSession(get().workspaces, request.sessionId);
        if (!workspaceId) return;
        if (get().sessionAllowedTools.has(request.toolName)) {
          get().respondToolApproval(workspaceId, true);
          return;
        }
        get().setPendingToolApproval(workspaceId, request);
      }
    );

    const removeSdkSessionId = api.agent.onSdkSessionId?.(
      (payload: { sdkSessionId: string; threadId: string; workspaceId?: string; provider?: import("@agentide/shared").AgentProvider }) => {
        const workspaceId =
          payload.workspaceId ?? findWorkspaceForThread(get().workspaces, payload.threadId);
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
                  t.id === payload.threadId
                    ? { ...t, sdkSessionId: payload.sdkSessionId, ...(payload.provider != null && { provider: payload.provider }) }
                    : t
                ),
              },
            },
          };
        });
      }
    );

    const cleanup = () => {
      removeMessage();
      removeResult();
      removeError();
      removeToolApproval?.();
      removeSdkSessionId?.();
    };
    set({ listenersInitialized: true, listenersCleanup: cleanup });
  },

  teardownListeners: () => {
    const cleanup = get().listenersCleanup;
    cleanup?.();
    set({ listenersInitialized: false, listenersCleanup: null });
  },
}));

import type {
  AgentMessage,
  AgentResult,
  AgentStatus,
  ChatData,
  ChatThread,
  ToolApprovalRequest,
} from "@agentide/shared";
import { create } from "zustand";
import { getElectronAPI } from "@/lib/electron";
import { useCostStore } from "./cost.store";

const CHAT_STORAGE_KEY = "agentide-chat";
const DEFAULT_MODEL = "claude-sonnet-4-20250514";

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

type AgentStoreState = {
  status: AgentStatus;
  sessionId: string | null;
  messages: AgentMessage[];
  threads: ChatThread[];
  activeThreadId: string;
  streamingText: string;
  totalCostUsd: number;
  error: string | null;
  selectedModel: string;
  requireApproval: boolean;
  pendingToolApproval: ToolApprovalRequest | null;

  startAgent: (prompt: string, workspaceId: string, options?: { displayContent?: string }) => Promise<void>;
  stopAgent: () => Promise<void>;
  addMessage: (message: AgentMessage) => void;
  setResult: (result: AgentResult) => void;
  setError: (error: string) => void;
  setSelectedModel: (model: string) => void;
  setRequireApproval: (value: boolean) => void;
  setPendingToolApproval: (request: ToolApprovalRequest | null) => void;
  respondToolApproval: (allow: boolean, message?: string) => Promise<void>;
  setMessages: (messages: AgentMessage[]) => void;
  clearMessages: () => void;
  loadHistory: (workspaceId: string) => void | Promise<void>;
  persistHistory: (workspaceId: string) => void | Promise<void>;
  startNewThread: (workspaceId: string) => void | Promise<void>;
  switchThread: (threadId: string) => void;
  initListeners: () => () => void;
};

export const useAgentStore = create<AgentStoreState>()((set, get) => ({
  status: "idle",
  sessionId: null,
  messages: [],
  threads: [],
  activeThreadId: "",
  streamingText: "",
  totalCostUsd: 0,
  error: null,
  selectedModel: DEFAULT_MODEL,
  requireApproval: true,
  pendingToolApproval: null,

  startAgent: async (prompt: string, workspaceId: string, options?: { displayContent?: string }) => {
    const api = getElectronAPI();
    if (!api) return;

    const { selectedModel, requireApproval, activeThreadId } = get();
    set({ status: "running", error: null, streamingText: "" });

    const userMessage: AgentMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: options?.displayContent ?? prompt,
      timestamp: Date.now(),
    };
    set((state) => {
      const nextMessages = [...state.messages, userMessage];
      const nextThreads = state.threads.map((t) =>
        t.id === activeThreadId ? { ...t, messages: nextMessages } : t
      );
      return { messages: nextMessages, threads: nextThreads };
    });

    const result = await api.agent.start({
      prompt,
      workspaceId,
      activeThreadId: activeThreadId || undefined,
      model: selectedModel,
      requireApproval,
    });
    if (result.success && result.data) {
      set({ sessionId: result.data.sessionId });
    } else {
      set({ status: "error", error: result.error || "Failed to start agent" });
    }
  },

  setSelectedModel: (model: string) => set({ selectedModel: model }),

  setRequireApproval: (value: boolean) => set({ requireApproval: value }),

  setPendingToolApproval: (request: ToolApprovalRequest | null) =>
    set({ pendingToolApproval: request }),

  respondToolApproval: async (allow: boolean, message?: string) => {
    const api = getElectronAPI();
    const { pendingToolApproval } = get();
    if (!api || !pendingToolApproval) return;
    await api.agent.respondToolApproval({
      requestId: pendingToolApproval.requestId,
      allow,
      message: allow ? undefined : message ?? "Denied by user",
    });
    set({ pendingToolApproval: null });
  },

  stopAgent: async () => {
    const api = getElectronAPI();
    const { sessionId } = get();
    if (!api || !sessionId) return;

    await api.agent.stop(sessionId);
    set({ status: "stopped" });
  },

  addMessage: (message: AgentMessage) => {
    if (message.isPartial) {
      set((state) => ({ streamingText: state.streamingText + message.content }));
      return;
    }

    set((state) => {
      const finalContent = state.streamingText || message.content;
      const nextMessages = [
        ...state.messages,
        { ...message, content: finalContent },
      ];
      const nextThreads = state.threads.map((t) =>
        t.id === state.activeThreadId ? { ...t, messages: nextMessages } : t
      );
      return {
        messages: nextMessages,
        threads: nextThreads,
        streamingText: "",
      };
    });
  },

  setResult: (result: AgentResult) => {
    if (result.totalCostUsd && result.totalCostUsd > 0) {
      useCostStore.getState().addCost(result.totalCostUsd);
    }
    set({
      status: result.success ? "idle" : "error",
      totalCostUsd: result.totalCostUsd || 0,
      error: result.error || null,
      streamingText: "",
    });
  },

  setError: (error: string) => {
    set({ status: "error", error, streamingText: "" });
  },

  setMessages: (messages: AgentMessage[]) => {
    set((state) => {
      const nextThreads = state.threads.map((t) =>
        t.id === state.activeThreadId ? { ...t, messages } : t
      );
      return { messages, threads: nextThreads, streamingText: "" };
    });
  },

  clearMessages: () => {
    set({ messages: [], streamingText: "", error: null, totalCostUsd: 0 });
  },

  loadHistory: async (workspaceId: string) => {
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

    const active = threads.find((t) => t.id === activeThreadId) ?? threads[0];
    set({
      threads,
      activeThreadId: active?.id ?? "",
      messages: active?.messages ?? [],
      streamingText: "",
      error: null,
    });
  },

  persistHistory: async (workspaceId: string) => {
    const { threads, activeThreadId, messages } = get();
    const nextThreads = threads.map((t) =>
      t.id === activeThreadId ? { ...t, messages } : t
    );
    const data: ChatData = { threads: nextThreads, activeThreadId };
    const api = getElectronAPI();
    if (api?.chat) {
      await api.chat.save(workspaceId, data);
      return;
    }
    saveToLocalStorage(workspaceId, data);
  },

  startNewThread: async (workspaceId: string) => {
    const { persistHistory } = get();
    const threadId = crypto.randomUUID();
    const newThread: ChatThread = {
      id: threadId,
      messages: [],
      createdAt: Date.now(),
    };
    set((state) => ({
      threads: [...state.threads, newThread],
      activeThreadId: threadId,
      messages: [],
      streamingText: "",
      error: null,
      totalCostUsd: 0,
    }));
    await persistHistory(workspaceId);
  },

  switchThread: (threadId: string) => {
    const { threads } = get();
    const thread = threads.find((t) => t.id === threadId);
    if (!thread) return;
    set({
      activeThreadId: threadId,
      messages: thread.messages,
      streamingText: "",
      error: null,
    });
  },

  initListeners: () => {
    const api = getElectronAPI();
    if (!api) return () => {};

    const removeMessage = api.agent.onMessage((message) => {
      get().addMessage(message);
    });

    const removeResult = api.agent.onResult((result) => {
      get().setResult(result);
    });

    const removeError = api.agent.onError((error) => {
      get().setError(error);
    });

    const removeToolApproval = api.agent.onToolApprovalRequest?.((request: ToolApprovalRequest) => {
      get().setPendingToolApproval(request);
    });

    return () => {
      removeMessage();
      removeResult();
      removeError();
      removeToolApproval?.();
    };
  },
}));

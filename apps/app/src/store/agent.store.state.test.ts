import { describe, it, expect, beforeEach, vi } from "vitest";
import { useAgentStore } from "./agent.store";
import type { AgentMessage, AgentResult, ChatThread } from "@agentide/shared";

const mockChatLoad = vi.fn();
const mockChatSave = vi.fn();
const mockAddCost = vi.fn();

vi.mock("@/lib/electron", () => ({
  getElectronAPI: vi.fn(() => ({
    chat: { load: mockChatLoad, save: mockChatSave },
  })),
}));

vi.mock("./cost.store", () => ({
  useCostStore: {
    getState: () => ({ addCost: mockAddCost }),
  },
}));

const workspaceId = "ws-1";
const threadA = "thread-a";
const threadB = "thread-b";
const sessionA = "session-a";
const sessionB = "session-b";

function msg(overrides: Partial<AgentMessage> = {}): AgentMessage {
  return {
    id: `msg-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    role: "assistant",
    content: "test",
    timestamp: Date.now(),
    ...overrides,
  };
}

function wsState(overrides: Partial<{
  threads: ChatThread[];
  activeThreadId: string;
  threadRuntime: Record<string, { status: "idle" | "running" | "error" | "stopped"; error: string | null; streamingText: string; streamingCommittedPrefix: string; sessionId: string | null; activeToolCalls: AgentMessage[] }>;
  sessionToThread: Record<string, string>;
}> = {}) {
  return {
    threads: [{ id: threadA, messages: [], createdAt: 1 }],
    activeThreadId: threadA,
    threadRuntime: {
      [threadA]: { status: "idle" as const, error: null, streamingText: "", streamingCommittedPrefix: "", sessionId: null, activeToolCalls: [] },
    },
    sessionToThread: {},
    ...overrides,
  };
}

describe("Agent store state management", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockChatLoad.mockResolvedValue({ success: false });
    mockChatSave.mockResolvedValue(undefined);
    useAgentStore.setState({ workspaces: {} });
  });

  describe("getThreadRuntime", () => {
    it("returns empty thread runtime for unknown workspace", () => {
      const rt = useAgentStore.getState().getThreadRuntime("unknown-ws", "unknown");
      expect(rt.status).toBe("idle");
      expect(rt.error).toBeNull();
      expect(rt.streamingText).toBe("");
      expect(rt.sessionId).toBeNull();
    });

    it("returns stored thread runtime when present", () => {
      useAgentStore.setState({
        workspaces: {
          [workspaceId]: wsState({
            threadRuntime: {
              [threadA]: {
                status: "running",
                error: null,
                streamingText: "",
                streamingCommittedPrefix: "",
                sessionId: sessionA,
                activeToolCalls: [],
              },
            },
          }),
        },
      });
      const rt = useAgentStore.getState().getThreadRuntime(workspaceId, threadA);
      expect(rt.status).toBe("running");
      expect(rt.sessionId).toBe(sessionA);
    });
  });

  describe("addMessage", () => {
    it("routes message to thread by sessionToThread when sessionId present", () => {
      useAgentStore.setState({
        workspaces: {
          [workspaceId]: wsState({
            threads: [
              { id: threadA, messages: [], createdAt: 1 },
              { id: threadB, messages: [], createdAt: 2 },
            ],
            activeThreadId: threadB,
            threadRuntime: {
              [threadA]: { status: "idle", error: null, streamingText: "", streamingCommittedPrefix: "", sessionId: null, activeToolCalls: [] },
              [threadB]: { status: "idle", error: null, streamingText: "", streamingCommittedPrefix: "", sessionId: null, activeToolCalls: [] },
            },
            sessionToThread: { [sessionA]: threadA },
          }),
        },
      });
      useAgentStore.getState().addMessage(msg({ sessionId: sessionA, content: "from A" }));

      const ws = useAgentStore.getState().getWorkspaceState(workspaceId);
      const tA = ws.threads.find((t) => t.id === threadA);
      const tB = ws.threads.find((t) => t.id === threadB);
      expect(tA?.messages).toHaveLength(1);
      expect(tA?.messages[0].content).toBe("from A");
      expect(tB?.messages ?? []).toHaveLength(0);
    });

    it("routes message to activeThreadId when no sessionId", () => {
      useAgentStore.setState({
        workspaces: {
          [workspaceId]: wsState({
            threads: [{ id: threadA, messages: [], createdAt: 1 }],
            activeThreadId: threadA,
          }),
        },
      });
      useAgentStore.getState().addMessage(msg({ content: "no session" }));

      const tA = useAgentStore.getState().getActiveThread(workspaceId);
      expect(tA?.messages).toHaveLength(1);
      expect(tA?.messages[0].content).toBe("no session");
    });

    it("replaces streamingText with partial message content (backend sends full accumulated text)", () => {
      useAgentStore.setState({
        workspaces: {
          [workspaceId]: wsState({
            threadRuntime: {
              [threadA]: {
                status: "running",
                error: null,
                streamingText: "",
                streamingCommittedPrefix: "",
                sessionId: sessionA,
                activeToolCalls: [],
              },
            },
            sessionToThread: { [sessionA]: threadA },
          }),
        },
      });
      useAgentStore.getState().addMessage(msg({ sessionId: sessionA, content: "a", isPartial: true }));
      useAgentStore.getState().addMessage(msg({ sessionId: sessionA, content: "ab", isPartial: true }));

      const rt = useAgentStore.getState().getThreadRuntime(workspaceId, threadA);
      expect(rt.streamingText).toBe("ab");
      const tA = useAgentStore.getState().getActiveThread(workspaceId);
      expect(tA?.messages).toHaveLength(0);
    });

    it("finalizes message with streamingText and updates threads array", () => {
      useAgentStore.setState({
        workspaces: {
          [workspaceId]: wsState({
            threads: [{ id: threadA, messages: [], createdAt: 1 }],
            threadRuntime: {
              [threadA]: {
                status: "running",
                error: null,
                streamingText: "pre",
                streamingCommittedPrefix: "",
                sessionId: sessionA,
                activeToolCalls: [],
              },
            },
            sessionToThread: { [sessionA]: threadA },
          }),
        },
      });
      useAgentStore.getState().addMessage(msg({ sessionId: sessionA, content: "final", isPartial: false }));

      const tA = useAgentStore.getState().getActiveThread(workspaceId);
      const rt = useAgentStore.getState().getThreadRuntime(workspaceId, threadA);
      expect(tA?.messages).toHaveLength(1);
      expect(tA?.messages[0].content).toBe("pre");
      expect(rt.streamingText).toBe("");
    });

    it("ignores message when sessionId has no mapping and activeThreadId empty", () => {
      useAgentStore.setState({
        workspaces: {
          [workspaceId]: wsState({
            threads: [],
            activeThreadId: "",
            threadRuntime: {},
            sessionToThread: {},
          }),
        },
      });
      useAgentStore.getState().addMessage(msg({ sessionId: "orphan", content: "x" }));

      const ws = useAgentStore.getState().getWorkspaceState(workspaceId);
      expect(ws.threads).toHaveLength(0);
    });
  });

  describe("setResult", () => {
    it("updates correct thread and clears sessionToThread entry", () => {
      useAgentStore.setState({
        workspaces: {
          [workspaceId]: wsState({
            threads: [{ id: threadA, messages: [msg()], createdAt: 1 }],
            threadRuntime: {
              [threadA]: {
                status: "running",
                error: null,
                streamingText: "",
                streamingCommittedPrefix: "",
                sessionId: sessionA,
                activeToolCalls: [],
              },
            },
            sessionToThread: { [sessionA]: threadA },
          }),
        },
      });
      useAgentStore.getState().setResult({
        sessionId: sessionA,
        success: true,
        totalCostUsd: 0.01,
      });

      const rt = useAgentStore.getState().getThreadRuntime(workspaceId, threadA);
      const ws = useAgentStore.getState().getWorkspaceState(workspaceId);
      expect(rt.status).toBe("idle");
      expect(rt.sessionId).toBeNull();
      expect(rt.error).toBeNull();
      expect(ws.sessionToThread[sessionA]).toBeUndefined();
    });

    it("does nothing when sessionId not in sessionToThread", () => {
      useAgentStore.setState({
        workspaces: {
          [workspaceId]: wsState({
            threadRuntime: {
              [threadA]: {
                status: "running",
                error: null,
                streamingText: "",
                streamingCommittedPrefix: "",
                sessionId: null,
                activeToolCalls: [],
              },
            },
            sessionToThread: {},
          }),
        },
      });
      useAgentStore.getState().setResult({ sessionId: "unknown", success: true });

      const rt = useAgentStore.getState().getThreadRuntime(workspaceId, threadA);
      expect(rt.status).toBe("running");
    });
  });

  describe("setError", () => {
    it("updates thread by sessionId and clears sessionToThread", () => {
      useAgentStore.setState({
        workspaces: {
          [workspaceId]: wsState({
            threadRuntime: {
              [threadA]: {
                status: "running",
                error: null,
                streamingText: "",
                streamingCommittedPrefix: "",
                sessionId: sessionA,
                activeToolCalls: [],
              },
            },
            sessionToThread: { [sessionA]: threadA },
          }),
        },
      });
      useAgentStore.getState().setError({ sessionId: sessionA, error: "Something failed" });

      const rt = useAgentStore.getState().getThreadRuntime(workspaceId, threadA);
      const ws = useAgentStore.getState().getWorkspaceState(workspaceId);
      expect(rt.status).toBe("error");
      expect(rt.error).toBe("Something failed");
      expect(ws.sessionToThread[sessionA]).toBeUndefined();
    });

    it("updates active thread when sessionId empty and workspaceId provided", () => {
      useAgentStore.setState({
        workspaces: {
          [workspaceId]: wsState({
            threadRuntime: {
              [threadA]: {
                status: "running",
                error: null,
                streamingText: "",
                streamingCommittedPrefix: "",
                sessionId: null,
                activeToolCalls: [],
              },
            },
          }),
        },
      });
      useAgentStore.getState().setError({
        sessionId: "",
        error: "Generic error",
        workspaceId,
      });

      const rt = useAgentStore.getState().getThreadRuntime(workspaceId, threadA);
      expect(rt.status).toBe("error");
      expect(rt.error).toBe("Generic error");
    });
  });

  describe("switchThread", () => {
    it("sets activeThreadId only and preserves thread data for target", () => {
      const messages = [msg({ id: "m1", content: "A message" })];
      useAgentStore.setState({
        workspaces: {
          [workspaceId]: wsState({
            threads: [
              { id: threadA, messages, createdAt: 1 },
              { id: threadB, messages: [], createdAt: 2 },
            ],
            activeThreadId: threadB,
            threadRuntime: {
              [threadA]: { status: "idle", error: null, streamingText: "", streamingCommittedPrefix: "", sessionId: null, activeToolCalls: [] },
              [threadB]: { status: "idle", error: null, streamingText: "", streamingCommittedPrefix: "", sessionId: null, activeToolCalls: [] },
            },
          }),
        },
      });
      useAgentStore.getState().switchThread(workspaceId, threadA);

      const ws = useAgentStore.getState().getWorkspaceState(workspaceId);
      expect(ws.activeThreadId).toBe(threadA);
      const tA = ws.threads.find((t) => t.id === threadA);
      expect(tA?.messages).toHaveLength(1);
      expect(tA?.messages[0].content).toBe("A message");
    });
  });

  describe("startNewThread", () => {
    it("adds new thread without clearing other threads", async () => {
      const existingMessages = [msg({ id: "m1", content: "existing" })];
      useAgentStore.setState({
        workspaces: {
          [workspaceId]: wsState({
            threads: [{ id: threadA, messages: existingMessages, createdAt: 1 }],
            activeThreadId: threadA,
          }),
        },
      });
      await useAgentStore.getState().startNewThread(workspaceId);

      const ws = useAgentStore.getState().getWorkspaceState(workspaceId);
      expect(ws.threads).toHaveLength(2);
      expect(ws.activeThreadId).not.toBe(threadA);
      const tA = ws.threads.find((t) => t.id === threadA);
      expect(tA?.messages).toHaveLength(1);
      expect(tA?.messages[0].content).toBe("existing");
      const newThread = ws.threads.find((t) => t.id !== threadA);
      expect(newThread?.messages).toHaveLength(0);
    });
  });

  describe("loadWorkspace", () => {
    it("populates workspace from loaded data", async () => {
      const threads: ChatThread[] = [
        { id: threadA, messages: [msg({ id: "a1", content: "a" })], createdAt: 1 },
        { id: threadB, messages: [msg({ id: "b1", content: "b" })], createdAt: 2 },
      ];
      mockChatLoad.mockResolvedValue({
        success: true,
        data: { threads, activeThreadId: threadA },
      });
      await useAgentStore.getState().loadWorkspace(workspaceId);

      const ws = useAgentStore.getState().getWorkspaceState(workspaceId);
      expect(ws.threads).toHaveLength(2);
      const tA = ws.threads.find((t) => t.id === threadA);
      const tB = ws.threads.find((t) => t.id === threadB);
      expect(tA?.messages).toHaveLength(1);
      expect(tA?.messages[0].content).toBe("a");
      expect(tB?.messages).toHaveLength(1);
      expect(tB?.messages[0].content).toBe("b");
      expect(ws.sessionToThread).toEqual({});
    });
  });

  describe("persistWorkspace", () => {
    it("writes threads and activeThreadId to storage", async () => {
      const threadAMessages = [msg({ id: "a1", content: "a" })];
      const threadBMessages = [msg({ id: "b1", content: "b" })];
      useAgentStore.setState({
        workspaces: {
          [workspaceId]: wsState({
            threads: [
              { id: threadA, messages: threadAMessages, createdAt: 1 },
              { id: threadB, messages: threadBMessages, createdAt: 2 },
            ],
            activeThreadId: threadB,
          }),
        },
      });
      await useAgentStore.getState().persistWorkspace(workspaceId);

      expect(mockChatSave).toHaveBeenCalledWith(workspaceId, expect.any(Object));
      const [, data] = mockChatSave.mock.calls[0];
      expect(data.activeThreadId).toBe(threadB);
      const tA = data.threads.find((t: ChatThread) => t.id === threadA);
      const tB = data.threads.find((t: ChatThread) => t.id === threadB);
      expect(tA.messages).toHaveLength(1);
      expect(tA.messages[0].content).toBe("a");
      expect(tB.messages).toHaveLength(1);
      expect(tB.messages[0].content).toBe("b");
    });
  });

  describe("multi-thread isolation", () => {
    it("messages for thread A do not appear in thread B after switch", () => {
      useAgentStore.setState({
        workspaces: {
          [workspaceId]: wsState({
            threads: [
              { id: threadA, messages: [], createdAt: 1 },
              { id: threadB, messages: [], createdAt: 2 },
            ],
            activeThreadId: threadA,
            threadRuntime: {
              [threadA]: { status: "idle", error: null, streamingText: "", streamingCommittedPrefix: "", sessionId: null, activeToolCalls: [] },
              [threadB]: { status: "idle", error: null, streamingText: "", streamingCommittedPrefix: "", sessionId: null, activeToolCalls: [] },
            },
            sessionToThread: { [sessionA]: threadA, [sessionB]: threadB },
          }),
        },
      });
      useAgentStore.getState().addMessage(msg({ sessionId: sessionA, content: "only in A" }));
      useAgentStore.getState().addMessage(msg({ sessionId: sessionB, content: "only in B" }));

      const ws = useAgentStore.getState().getWorkspaceState(workspaceId);
      const tA = ws.threads.find((t) => t.id === threadA);
      const tB = ws.threads.find((t) => t.id === threadB);
      expect(tA?.messages).toHaveLength(1);
      expect(tA?.messages[0].content).toBe("only in A");
      expect(tB?.messages).toHaveLength(1);
      expect(tB?.messages[0].content).toBe("only in B");

      useAgentStore.getState().switchThread(workspaceId, threadB);
      const ws2 = useAgentStore.getState().getWorkspaceState(workspaceId);
      const tB2 = ws2.threads.find((t) => t.id === threadB);
      expect(tB2?.messages).toHaveLength(1);
      expect(tB2?.messages[0].content).toBe("only in B");

      useAgentStore.getState().switchThread(workspaceId, threadA);
      const ws3 = useAgentStore.getState().getWorkspaceState(workspaceId);
      const tA3 = ws3.threads.find((t) => t.id === threadA);
      expect(tA3?.messages).toHaveLength(1);
      expect(tA3?.messages[0].content).toBe("only in A");
    });
  });

  describe("clearError", () => {
    it("clears error for active thread only", () => {
      useAgentStore.setState({
        workspaces: {
          [workspaceId]: wsState({
            threads: [
              { id: threadA, messages: [], createdAt: 1 },
              { id: threadB, messages: [], createdAt: 2 },
            ],
            activeThreadId: threadA,
            threadRuntime: {
              [threadA]: { status: "error", error: "err A", streamingText: "", streamingCommittedPrefix: "", sessionId: null, activeToolCalls: [] },
              [threadB]: { status: "error", error: "err B", streamingText: "", streamingCommittedPrefix: "", sessionId: null, activeToolCalls: [] },
            },
          }),
        },
      });
      useAgentStore.getState().clearError(workspaceId);

      const rtA = useAgentStore.getState().getThreadRuntime(workspaceId, threadA);
      const rtB = useAgentStore.getState().getThreadRuntime(workspaceId, threadB);
      expect(rtA.error).toBeNull();
      expect(rtB.error).toBe("err B");
    });
  });
});

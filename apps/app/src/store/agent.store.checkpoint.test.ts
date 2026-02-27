import { describe, it, expect, beforeEach, vi } from "vitest";
import { useAgentStore } from "./agent.store";
import type { Checkpoint } from "@agentide/shared";

const mockCheckpointCreate = vi.fn();
const mockCheckpointRestore = vi.fn();
const mockChatSave = vi.fn();

vi.mock("@/lib/electron", () => ({
  getElectronAPI: vi.fn(() => ({
    checkpoint: {
      create: mockCheckpointCreate,
      restore: mockCheckpointRestore,
    },
    chat: { save: mockChatSave },
  })),
}));

const msgs = [
  { id: "m0", role: "user" as const, content: "Hello", timestamp: 1 },
  { id: "m1", role: "assistant" as const, content: "Hi", timestamp: 2 },
];

describe("Agent store checkpoint", () => {
  const workspaceId = "ws-1";
  const threadId = "thread-1";

  function setWorkspaceState() {
    useAgentStore.setState({
      workspaces: {
        [workspaceId]: {
          threads: [
            { id: threadId, messages: [...msgs], createdAt: 1 },
          ],
          activeThreadId: threadId,
          threadRuntime: {
            [threadId]: {
              status: "idle",
              error: null,
              streamingText: "",
              sessionId: null,
            },
          },
          sessionToThread: {},
        },
      },
    });
  }

  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckpointCreate.mockResolvedValue({
      success: true,
      data: {
        id: "cp-1",
        threadId,
        messageIndex: 0,
        timestamp: Date.now(),
        gitStashRef: "stash-ref-123",
      } as Checkpoint,
    });
    mockCheckpointRestore.mockResolvedValue({ success: true });
    mockChatSave.mockResolvedValue(undefined);
    setWorkspaceState();
  });

  describe("createCheckpoint", () => {
    it("calls api.checkpoint.create with messageIndex = messages.length and appends checkpoint to thread", async () => {
      const { createCheckpoint } = useAgentStore.getState();
      const checkpoint = await createCheckpoint(workspaceId);

      expect(mockCheckpointCreate).toHaveBeenCalledWith({
        workspaceId,
        activeThreadId: threadId,
        messageIndex: 2,
      });
      expect(checkpoint).not.toBeNull();
      expect(checkpoint?.id).toBe("cp-1");
      expect(checkpoint?.messageIndex).toBe(0);

      const activeThread = useAgentStore.getState().getActiveThread(workspaceId);
      expect(activeThread?.checkpoints).toHaveLength(1);
      expect(activeThread?.checkpoints?.[0].id).toBe("cp-1");
    });

    it("stores checkpoint with no gitStashRef when create returns one without ref", async () => {
      mockCheckpointCreate.mockResolvedValueOnce({
        success: true,
        data: {
          id: "cp-no-ref",
          threadId,
          messageIndex: 1,
          timestamp: Date.now(),
          gitStashRef: undefined,
        } as Checkpoint,
      });
      const singleMsg = [{ id: "m0", role: "user" as const, content: "Hi", timestamp: 1 }];
      useAgentStore.setState({
        workspaces: {
          [workspaceId]: {
            threads: [{ id: threadId, messages: singleMsg, createdAt: 1 }],
            activeThreadId: threadId,
            threadRuntime: {
              [threadId]: {
                status: "idle",
                error: null,
                streamingText: "",
                sessionId: null,
              },
            },
            sessionToThread: {},
          },
        },
      });

      const { createCheckpoint } = useAgentStore.getState();
      const checkpoint = await createCheckpoint(workspaceId);

      expect(checkpoint?.gitStashRef).toBeUndefined();
      const activeThread = useAgentStore.getState().getActiveThread(workspaceId);
      expect(activeThread?.checkpoints?.[0].gitStashRef).toBeUndefined();
    });

    it("returns null when activeThreadId is empty", async () => {
      useAgentStore.setState({
        workspaces: {
          [workspaceId]: {
            threads: [{ id: threadId, messages: [...msgs], createdAt: 1 }],
            activeThreadId: "",
            threadRuntime: { [threadId]: { status: "idle", error: null, streamingText: "", sessionId: null } },
            sessionToThread: {},
          },
        },
      });
      const { createCheckpoint } = useAgentStore.getState();
      const checkpoint = await createCheckpoint(workspaceId);
      expect(checkpoint).toBeNull();
      expect(mockCheckpointCreate).not.toHaveBeenCalled();
    });
  });

  describe("rewindToCheckpoint", () => {
    const checkpointBoth: Checkpoint = {
      id: "cp-rewind",
      threadId,
      messageIndex: 0,
      timestamp: 1,
      gitStashRef: "ref-456",
    };

    beforeEach(() => {
      useAgentStore.setState({
        workspaces: {
          [workspaceId]: {
            threads: [
              {
                id: threadId,
                messages: [...msgs],
                createdAt: 1,
                checkpoints: [checkpointBoth],
              },
            ],
            activeThreadId: threadId,
            threadRuntime: {
              [threadId]: { status: "idle", error: null, streamingText: "", sessionId: null },
            },
            sessionToThread: {},
          },
        },
      });
    });

    it("truncates messages to checkpoint.messageIndex and persists when mode is conversation", async () => {
      const { rewindToCheckpoint } = useAgentStore.getState();
      await rewindToCheckpoint(workspaceId, checkpointBoth.id, "conversation");

      const activeThread = useAgentStore.getState().getActiveThread(workspaceId);
      expect(activeThread?.messages).toHaveLength(0);
      expect(mockChatSave).toHaveBeenCalled();
      expect(mockCheckpointRestore).not.toHaveBeenCalled();
    });

    it("calls checkpoint.restore when mode is code and checkpoint has gitStashRef", async () => {
      const { rewindToCheckpoint } = useAgentStore.getState();
      await rewindToCheckpoint(workspaceId, checkpointBoth.id, "code");

      expect(mockCheckpointRestore).toHaveBeenCalledWith({
        workspaceId,
        stashRef: "ref-456",
      });
      const activeThread = useAgentStore.getState().getActiveThread(workspaceId);
      expect(activeThread?.messages).toHaveLength(2);
    });

    it("does both truncate and code restore when mode is both", async () => {
      const { rewindToCheckpoint } = useAgentStore.getState();
      await rewindToCheckpoint(workspaceId, checkpointBoth.id, "both");

      const activeThread = useAgentStore.getState().getActiveThread(workspaceId);
      expect(activeThread?.messages).toHaveLength(0);
      expect(mockCheckpointRestore).toHaveBeenCalledWith({
        workspaceId,
        stashRef: "ref-456",
      });
      expect(mockChatSave).toHaveBeenCalled();
    });

    it("does nothing when checkpoint is not found", async () => {
      const { rewindToCheckpoint } = useAgentStore.getState();
      await rewindToCheckpoint(workspaceId, "nonexistent-id", "both");

      const activeThread = useAgentStore.getState().getActiveThread(workspaceId);
      expect(activeThread?.messages).toHaveLength(2);
      expect(mockCheckpointRestore).not.toHaveBeenCalled();
      expect(mockChatSave).not.toHaveBeenCalled();
    });

    it("does not call restore when mode is code but checkpoint has no gitStashRef", async () => {
      const singleMsg = [{ id: "m0", role: "user" as const, content: "Hello", timestamp: 1 }];
      useAgentStore.setState({
        workspaces: {
          [workspaceId]: {
            threads: [
              {
                id: threadId,
                messages: singleMsg,
                createdAt: 1,
                checkpoints: [{ ...checkpointBoth, id: "cp-no-ref", gitStashRef: undefined }],
              },
            ],
            activeThreadId: threadId,
            threadRuntime: {
              [threadId]: { status: "idle", error: null, streamingText: "", sessionId: null },
            },
            sessionToThread: {},
          },
        },
      });
      const { rewindToCheckpoint } = useAgentStore.getState();
      await rewindToCheckpoint(workspaceId, "cp-no-ref", "code");

      expect(mockCheckpointRestore).not.toHaveBeenCalled();
    });
  });
});

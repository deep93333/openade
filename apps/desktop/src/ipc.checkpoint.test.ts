import { describe, it, expect, beforeEach, vi } from "vitest";
import { IPC } from "@agentide/shared";

const {
  handlers,
  mockWorkspaceGet,
  mockGetChat,
  mockSetChat,
  mockStashCreate,
  mockStashApply,
  mockGetCurrentHead,
  mockGetUntrackedFiles,
  mockCreateRef,
  mockGetModifiedFilesBetween,
  mockSaveSnapshots,
  mockLoadSnapshots,
  mockRestoreFromSnapshots,
  mockDeleteThreadSnapshots,
} = vi.hoisted(() => {
  const handlers: Record<string, (event: unknown, ...args: unknown[]) => Promise<unknown>> = {};
  return {
    handlers,
    mockWorkspaceGet: vi.fn(),
    mockGetChat: vi.fn(),
    mockSetChat: vi.fn(),
    mockStashCreate: vi.fn(),
    mockStashApply: vi.fn(),
    mockGetCurrentHead: vi.fn(),
    mockGetUntrackedFiles: vi.fn(),
    mockCreateRef: vi.fn(),
    mockGetModifiedFilesBetween: vi.fn(),
    mockSaveSnapshots: vi.fn(),
    mockLoadSnapshots: vi.fn(),
    mockRestoreFromSnapshots: vi.fn(),
    mockDeleteThreadSnapshots: vi.fn(),
  };
});

vi.mock("electron", () => ({
  app: {
    getPath: () => "",
    isPackaged: false,
  },
  ipcMain: {
    handle: (channel: string, fn: (event: unknown, ...args: unknown[]) => Promise<unknown>) => {
      handlers[channel] = fn;
    },
  },
  dialog: {},
  shell: { openPath: vi.fn() },
}));

vi.mock("./services/workspace-manager", () => ({
  workspaceManager: { get: mockWorkspaceGet },
}));

vi.mock("./services/chat-storage", () => ({
  getChat: (...args: unknown[]) => mockGetChat(...args),
  setChat: (...args: unknown[]) => mockSetChat(...args),
  deleteThread: vi.fn(),
}));

vi.mock("./services/git-service", () => ({
  gitService: {
    stashCreate: (...args: unknown[]) => mockStashCreate(...args),
    stashApply: (...args: unknown[]) => mockStashApply(...args),
    getCurrentHead: (...args: unknown[]) => mockGetCurrentHead(...args),
    getUntrackedFiles: (...args: unknown[]) => mockGetUntrackedFiles(...args),
    createRef: (...args: unknown[]) => mockCreateRef(...args),
    getModifiedFilesBetween: (...args: unknown[]) => mockGetModifiedFilesBetween(...args),
    deleteCheckpointRefs: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("./services/snapshot-store", () => ({
  saveSnapshots: (...args: unknown[]) => mockSaveSnapshots(...args),
  loadSnapshots: (...args: unknown[]) => mockLoadSnapshots(...args),
  restoreFromSnapshots: (...args: unknown[]) => mockRestoreFromSnapshots(...args),
  deleteThreadSnapshots: (...args: unknown[]) => mockDeleteThreadSnapshots(...args),
  deleteCheckpointSnapshots: vi.fn(),
  runGarbageCollection: vi.fn().mockResolvedValue({ deletedDirs: 0, freedBytes: 0 }),
}));

vi.mock("./services/agent-manager", () => ({ agentManager: {}, getAllModels: vi.fn().mockReturnValue([]), generateThreadTitle: vi.fn().mockResolvedValue(null) }));
vi.mock("./services/config-storage", () => ({ get: vi.fn(), set: vi.fn() }));
vi.mock("./services/terminal-service", () => ({ create: vi.fn() }));
vi.mock("./windows/app-window", () => ({ getAppWindow: () => null }));
vi.mock("./services/workspace-events", () => ({
  initWorkspaceEvents: vi.fn(),
  setActiveWorkspace: vi.fn(),
  clearActiveWorkspace: vi.fn(),
  getActiveWorkspaceId: vi.fn(),
}));
vi.mock("./services/agent-log", () => ({
  getAgentLogPath: vi.fn().mockReturnValue("/tmp/agent.log"),
  getAgentLogDir: vi.fn().mockReturnValue("/tmp"),
}));
vi.mock("./services/filesystem-service", () => ({
  readDirectoryTree: vi.fn().mockResolvedValue({ name: "", path: "", type: "directory", children: [] }),
  readDirectoryChildren: vi.fn().mockResolvedValue([]),
}));
vi.mock("./services/skills-service", () => ({
  loadSkillsFromDir: vi.fn().mockResolvedValue([]),
  getSkillContent: vi.fn().mockResolvedValue(null),
}));
vi.mock("./services/editor-service", () => ({
  openFileInExternalEditor: vi.fn().mockResolvedValue({ success: true }),
}));

import { registerIpcHandlers } from "./ipc";

describe("Checkpoint IPC handlers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockWorkspaceGet.mockReturnValue({ path: "/tmp/workspace" });
    mockGetChat.mockReturnValue({
      threads: [
        {
          id: "thread-1",
          messages: [],
          createdAt: 0,
        },
      ],
    });
    mockStashCreate.mockResolvedValue("stash-ref-abc");
    mockStashApply.mockResolvedValue(undefined);
    mockGetCurrentHead.mockResolvedValue("head-abc");
    mockGetUntrackedFiles.mockResolvedValue([]);
    mockCreateRef.mockResolvedValue(undefined);
    mockGetModifiedFilesBetween.mockResolvedValue([]);
    mockSaveSnapshots.mockResolvedValue("/tmp/snapshots/ws-1/thread-1/cp-1");
    mockLoadSnapshots.mockResolvedValue([]);
    mockRestoreFromSnapshots.mockResolvedValue({ restored: [], deleted: [], errors: [] });
    mockDeleteThreadSnapshots.mockResolvedValue(undefined);
  });

  it("CHECKPOINT_CREATE: creates checkpoint and persists to chat storage", async () => {
    registerIpcHandlers();
    const handler = handlers[IPC.CHECKPOINT_CREATE];
    expect(handler).toBeDefined();

    const result = await handler!(null, {
      workspaceId: "ws-1",
      activeThreadId: "thread-1",
      messageIndex: 0,
    });

    expect(result).toEqual(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          checkpoint: expect.objectContaining({
            threadId: "thread-1",
            messageIndex: 0,
            gitStashRef: expect.any(String),
          }),
        }),
      })
    );
    expect(mockStashCreate).toHaveBeenCalledWith("/tmp/workspace");
    expect(mockGetChat).toHaveBeenCalledWith("ws-1");
    expect(mockSetChat).toHaveBeenCalledWith(
      "ws-1",
      expect.objectContaining({
        threads: expect.arrayContaining([
          expect.objectContaining({
            id: "thread-1",
            checkpoints: expect.arrayContaining([
              expect.objectContaining({
                messageIndex: 0,
                gitStashRef: expect.any(String),
              }),
            ]),
          }),
        ]),
      })
    );
  });

  it("CHECKPOINT_CREATE: stores checkpoint without gitStashRef when no changes", async () => {
    mockStashCreate.mockResolvedValue(null);
    registerIpcHandlers();
    const handler = handlers[IPC.CHECKPOINT_CREATE];

    const result = await handler!(null, {
      workspaceId: "ws-1",
      activeThreadId: "thread-1",
      messageIndex: 1,
    });

    expect(result).toMatchObject({ success: true });
    const setCall = mockSetChat.mock.calls[0];
    const checkpoint = setCall[1].threads[0].checkpoints[0];
    expect(checkpoint.gitStashRef).toBeUndefined();
    expect(checkpoint.messageIndex).toBe(1);
  });

  it("CHECKPOINT_CREATE: returns error when workspace not found", async () => {
    mockWorkspaceGet.mockReturnValue(undefined);
    registerIpcHandlers();
    const handler = handlers[IPC.CHECKPOINT_CREATE];

    const result = await handler!(null, {
      workspaceId: "ws-missing",
      activeThreadId: "thread-1",
      messageIndex: 0,
    });

    expect(result).toEqual({ success: false, error: "Workspace not found" });
    expect(mockStashCreate).not.toHaveBeenCalled();
  });

  it("CHECKPOINT_RESTORE: calls stashApply and returns success", async () => {
    registerIpcHandlers();
    const handler = handlers[IPC.CHECKPOINT_RESTORE];

    const result = await handler!(null, {
      workspaceId: "ws-1",
      stashRef: "stash-ref-xyz",
    });

    expect(result).toEqual({ success: true });
    expect(mockStashApply).toHaveBeenCalledWith("/tmp/workspace", "stash-ref-xyz");
  });

  it("CHECKPOINT_RESTORE: returns error when workspace not found", async () => {
    mockWorkspaceGet.mockReturnValue(undefined);
    registerIpcHandlers();
    const handler = handlers[IPC.CHECKPOINT_RESTORE];

    const result = await handler!(null, {
      workspaceId: "ws-missing",
      stashRef: "ref",
    });

    expect(result).toEqual({ success: false, error: "Workspace not found" });
    expect(mockStashApply).not.toHaveBeenCalled();
  });

  it("CHECKPOINT_RESTORE: returns error when stashApply throws", async () => {
    mockStashApply.mockRejectedValue(new Error("Invalid ref"));
    registerIpcHandlers();
    const handler = handlers[IPC.CHECKPOINT_RESTORE];

    const result = await handler!(null, {
      workspaceId: "ws-1",
      stashRef: "bad-ref",
    });

    expect(result).toMatchObject({ success: false, error: "Invalid ref" });
  });

  it("CHECKPOINT_SAVE_SNAPSHOTS: saves snapshots and returns storage path", async () => {
    registerIpcHandlers();
    const handler = handlers[IPC.CHECKPOINT_SAVE_SNAPSHOTS];
    expect(handler).toBeDefined();

    const result = await handler!(null, {
      workspaceId: "ws-1",
      threadId: "thread-1",
      checkpointId: "cp-snap-1",
      snapshots: [
        { filePath: "/tmp/workspace/src/index.ts", beforeContent: "const x = 1;", existed: true },
      ],
    });

    expect(result).toMatchObject({ success: true });
    expect(mockSaveSnapshots).toHaveBeenCalledWith(
      "ws-1",
      "thread-1",
      "cp-snap-1",
      expect.arrayContaining([
        expect.objectContaining({ filePath: "/tmp/workspace/src/index.ts" }),
      ])
    );
  });

  it("CHECKPOINT_RESTORE_SNAPSHOTS: loads and restores snapshots", async () => {
    mockLoadSnapshots.mockResolvedValue([
      { filePath: "/tmp/workspace/src/index.ts", beforeContent: "const x = 1;", existed: true },
    ]);
    mockRestoreFromSnapshots.mockResolvedValue({
      restored: ["/tmp/workspace/src/index.ts"],
      deleted: [],
      errors: [],
    });
    registerIpcHandlers();
    const handler = handlers[IPC.CHECKPOINT_RESTORE_SNAPSHOTS];
    expect(handler).toBeDefined();

    const result = await handler!(null, {
      workspaceId: "ws-1",
      threadId: "thread-1",
      checkpointId: "cp-snap-1",
    });

    expect(result).toMatchObject({
      success: true,
      data: {
        restored: ["/tmp/workspace/src/index.ts"],
        deleted: [],
        errors: [],
      },
    });
    expect(mockLoadSnapshots).toHaveBeenCalledWith("ws-1", "thread-1", "cp-snap-1");
    expect(mockRestoreFromSnapshots).toHaveBeenCalled();
  });

  it("CHECKPOINT_RESTORE_SNAPSHOTS: returns error when no snapshots found", async () => {
    mockLoadSnapshots.mockResolvedValue([]);
    registerIpcHandlers();
    const handler = handlers[IPC.CHECKPOINT_RESTORE_SNAPSHOTS];

    const result = await handler!(null, {
      workspaceId: "ws-1",
      threadId: "thread-1",
      checkpointId: "cp-empty",
    });

    expect(result).toMatchObject({ success: false, error: "No snapshots found for this checkpoint" });
    expect(mockRestoreFromSnapshots).not.toHaveBeenCalled();
  });

  it("CHAT_DELETE_THREAD: also cleans up thread snapshots", async () => {
    mockGetChat.mockReturnValue({
      threads: [
        { id: "thread-1", messages: [], createdAt: 0, updatedAt: 0 },
        { id: "thread-2", messages: [], createdAt: 0, updatedAt: 0 },
      ],
    });
    registerIpcHandlers();
    const handler = handlers[IPC.CHAT_DELETE_THREAD];

    await handler!(null, "ws-1", "thread-1");

    expect(mockDeleteThreadSnapshots).toHaveBeenCalledWith("ws-1", "thread-1");
  });
});

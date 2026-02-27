import { describe, it, expect, beforeEach, vi } from "vitest";
import { IPC } from "@agentide/shared";

const {
  handlers,
  mockWorkspaceGet,
  mockGetChat,
  mockSetChat,
  mockStashCreate,
  mockStashApply,
} = vi.hoisted(() => {
  const handlers: Record<string, (event: unknown, ...args: unknown[]) => Promise<unknown>> = {};
  return {
    handlers,
    mockWorkspaceGet: vi.fn(),
    mockGetChat: vi.fn(),
    mockSetChat: vi.fn(),
    mockStashCreate: vi.fn(),
    mockStashApply: vi.fn(),
  };
});

vi.mock("electron", () => ({
  ipcMain: {
    handle: (channel: string, fn: (event: unknown, ...args: unknown[]) => Promise<unknown>) => {
      handlers[channel] = fn;
    },
  },
  dialog: {},
}));

vi.mock("./services/workspace-manager", () => ({
  workspaceManager: { get: mockWorkspaceGet },
}));

vi.mock("./services/chat-storage", () => ({
  getChat: (...args: unknown[]) => mockGetChat(...args),
  setChat: (...args: unknown[]) => mockSetChat(...args),
}));

vi.mock("./services/git-service", () => ({
  gitService: {
    stashCreate: (...args: unknown[]) => mockStashCreate(...args),
    stashApply: (...args: unknown[]) => mockStashApply(...args),
  },
}));

vi.mock("./services/agent-manager", () => ({ agentManager: {} }));
vi.mock("./services/config-storage", () => ({ get: vi.fn(), set: vi.fn() }));
vi.mock("./services/terminal-service", () => ({ create: vi.fn() }));
vi.mock("./windows/app-window", () => ({ getAppWindow: () => null }));

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
          threadId: "thread-1",
          messageIndex: 0,
          gitStashRef: "stash-ref-abc",
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
                gitStashRef: "stash-ref-abc",
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
});

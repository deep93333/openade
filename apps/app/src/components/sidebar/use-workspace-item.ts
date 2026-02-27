import type { ChatThread, TaskStatus, Workspace } from "@agentide/shared";
import { useState } from "react";
import { useWorkspaceStore } from "@/store/workspace.store";
import { useAgentStore } from "@/store/agent.store";
import { useUIStore } from "@/store/ui.store";
import { threadLabel } from "./utils";

export type WorkspaceItemState = {
  workspace: Workspace;
  isActive: boolean;
  threads: ChatThread[];
  activeThreadId: string;
  getThreadRuntime: ReturnType<typeof useAgentStore>["getThreadRuntime"];
};

export type WorkspaceItemHandlers = {
  handleNewChat: (e: React.MouseEvent) => Promise<void>;
  handleSwitchThread: (threadId: string) => Promise<void>;
  handleDeleteThread: (threadId: string, e: React.MouseEvent) => void;
  handleTaskStatusChange: (threadId: string, taskStatus: TaskStatus) => Promise<void>;
  handleWorkspaceSelect: (e: React.MouseEvent) => void;
  handleRemoveWorkspaceClick: (e: React.MouseEvent) => void;
};

export type DeleteThreadState = {
  threadToDelete: { id: string; name: string } | null;
  setThreadToDelete: (v: { id: string; name: string } | null) => void;
  confirmDeleteThread: () => Promise<void>;
};

export type RemoveWorkspaceState = {
  showRemoveWorkspaceConfirm: boolean;
  setShowRemoveWorkspaceConfirm: (v: boolean) => void;
  confirmRemoveWorkspace: () => Promise<void>;
};

export function useWorkspaceItem(workspace: Workspace) {
  const [threadToDelete, setThreadToDelete] = useState<{ id: string; name: string } | null>(null);
  const [showRemoveWorkspaceConfirm, setShowRemoveWorkspaceConfirm] = useState(false);

  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const selectWorkspace = useWorkspaceStore((s) => s.selectWorkspace);
  const deleteWorkspace = useWorkspaceStore((s) => s.deleteWorkspace);
  const setCenterPage = useUIStore((s) => s.setCenterPage);

  const workspaceState = useAgentStore((s) =>
    workspace.id === activeWorkspaceId ? s.getWorkspaceState(workspace.id) : null
  );
  const threads = workspaceState?.threads ?? [];
  const activeThreadId = workspaceState?.activeThreadId ?? "";
  const getThreadRuntime = useAgentStore((s) => s.getThreadRuntime);
  const startNewThread = useAgentStore((s) => s.startNewThread);
  const switchThread = useAgentStore((s) => s.switchThread);
  const persistWorkspace = useAgentStore((s) => s.persistWorkspace);
  const deleteThread = useAgentStore((s) => s.deleteThread);
  const updateThreadTaskStatus = useAgentStore((s) => s.updateThreadTaskStatus);
  const loadWorkspace = useAgentStore((s) => s.loadWorkspace);

  const isActive = activeWorkspaceId === workspace.id;

  const handleNewChat = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isActive) {
      setCenterPage("chat");
      await selectWorkspace(workspace.id);
      await loadWorkspace(workspace.id);
    } else {
      setCenterPage("chat");
    }
    await startNewThread(workspace.id);
  };

  const handleSwitchThread = async (threadId: string) => {
    if (threadId === activeThreadId || activeWorkspaceId !== workspace.id) return;
    setCenterPage("chat");
    await persistWorkspace(workspace.id);
    switchThread(workspace.id, threadId);
  };

  const handleDeleteThread = (threadId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (activeWorkspaceId !== workspace.id) return;
    if (threads.length <= 1) return;
    const thread = threads.find((t) => t.id === threadId);
    if (thread) {
      setThreadToDelete({ id: threadId, name: threadLabel(thread) });
    }
  };

  const confirmDeleteThread = async () => {
    if (!threadToDelete || activeWorkspaceId !== workspace.id) return;
    try {
      await deleteThread(workspace.id, threadToDelete.id);
    } finally {
      setThreadToDelete(null);
    }
  };

  const handleTaskStatusChange = async (threadId: string, taskStatus: TaskStatus) => {
    if (activeWorkspaceId !== workspace.id) return;
    await updateThreadTaskStatus(workspace.id, threadId, taskStatus);
  };

  const handleWorkspaceSelect = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!isActive) {
      setCenterPage("chat");
      selectWorkspace(workspace.id);
    }
  };

  const handleRemoveWorkspaceClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowRemoveWorkspaceConfirm(true);
  };

  const confirmRemoveWorkspace = async () => {
    await deleteWorkspace(workspace.id);
    setShowRemoveWorkspaceConfirm(false);
  };

  const state: WorkspaceItemState = {
    workspace,
    isActive,
    threads,
    activeThreadId,
    getThreadRuntime,
  };

  const handlers: WorkspaceItemHandlers = {
    handleNewChat,
    handleSwitchThread,
    handleDeleteThread,
    handleTaskStatusChange,
    handleWorkspaceSelect,
    handleRemoveWorkspaceClick,
  };

  const deleteState: DeleteThreadState = {
    threadToDelete,
    setThreadToDelete,
    confirmDeleteThread,
  };

  const removeWorkspaceState: RemoveWorkspaceState = {
    showRemoveWorkspaceConfirm,
    setShowRemoveWorkspaceConfirm,
    confirmRemoveWorkspace,
  };

  return { state, handlers, deleteState, removeWorkspaceState };
}

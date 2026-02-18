import type { Workspace, GitBranch } from "@agentide/shared";
import { create } from "zustand";
import { getElectronAPI } from "@/lib/electron";

const ACTIVE_WORKSPACE_KEY = "agentide-active-workspace";

const saveActiveWorkspaceId = (workspaceId: string | null): void => {
  try {
    if (workspaceId) {
      localStorage.setItem(ACTIVE_WORKSPACE_KEY, workspaceId);
    } else {
      localStorage.removeItem(ACTIVE_WORKSPACE_KEY);
    }
  } catch {
    // ignore storage errors
  }
};

const loadActiveWorkspaceId = (): string | null => {
  try {
    return localStorage.getItem(ACTIVE_WORKSPACE_KEY);
  } catch {
    return null;
  }
};

type WorkspaceStoreState = {
  workspaces: Workspace[];
  activeWorkspace: Workspace | null;
  isLoading: boolean;

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
};

export const useWorkspaceStore = create<WorkspaceStoreState>()((set) => ({
  workspaces: [],
  activeWorkspace: null,
  isLoading: false,

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
    const savedWorkspaceId = loadActiveWorkspaceId();
    if (savedWorkspaceId) {
      const api = getElectronAPI();
      if (!api) return;

      // Try to select the saved workspace
      const result = await api.workspace.select(savedWorkspaceId);
      if (result.success && result.data) {
        set({ activeWorkspace: result.data });

        // Import and call loadHistory from agent store to load threads for this workspace
        const { useAgentStore } = await import("./agent.store");
        const { loadHistory } = useAgentStore.getState();
        await loadHistory(result.data.id);
      } else {
        // Clear invalid saved workspace ID
        saveActiveWorkspaceId(null);
      }
    }
  },

  createWorkspace: async (name: string, path: string) => {
    const api = getElectronAPI();
    if (!api) return;

    const result = await api.workspace.create({ name, path });
    if (result.success && result.data) {
      set((state) => ({
        workspaces: [result.data!, ...state.workspaces],
        activeWorkspace: result.data!,
      }));

      // Save the newly created workspace as active
      saveActiveWorkspaceId(result.data!.id);

      // Load history for the new workspace
      const { useAgentStore } = await import("./agent.store");
      const { loadHistory } = useAgentStore.getState();
      await loadHistory(result.data!.id);
    }
  },

  deleteWorkspace: async (id: string) => {
    const api = getElectronAPI();
    if (!api) return;

    const result = await api.workspace.delete(id);
    if (result.success) {
      set((state) => {
        const isActiveWorkspace = state.activeWorkspace?.id === id;
        if (isActiveWorkspace) {
          // Clear saved active workspace if we're deleting the active one
          saveActiveWorkspaceId(null);
        }
        return {
          workspaces: state.workspaces.filter((w) => w.id !== id),
          activeWorkspace: isActiveWorkspace ? null : state.activeWorkspace,
        };
      });
    }
  },

  selectWorkspace: async (id: string) => {
    const api = getElectronAPI();
    if (!api) return;

    const result = await api.workspace.select(id);
    if (result.success && result.data) {
      set({ activeWorkspace: result.data });

      // Save the selected workspace ID to localStorage
      saveActiveWorkspaceId(result.data.id);

      // Import and call loadHistory from agent store to load threads for this workspace
      const { useAgentStore } = await import("./agent.store");
      const { loadHistory } = useAgentStore.getState();
      await loadHistory(result.data.id);
    }
  },

  clearActiveWorkspace: () => {
    saveActiveWorkspaceId(null);
    set({ activeWorkspace: null });
  },

  refreshGitInfo: async (id: string) => {
    const api = getElectronAPI();
    if (!api) return;

    const result = await api.workspace.refreshGit(id);
    if (result.success && result.data) {
      set((state) => ({
        workspaces: state.workspaces.map((w) =>
          w.id === id ? result.data! : w
        ),
        activeWorkspace: state.activeWorkspace?.id === id ? result.data! : state.activeWorkspace,
      }));
    }
  },

  getGitBranches: async (id: string): Promise<GitBranch[]> => {
    const api = getElectronAPI();
    if (!api) return [];

    const result = await api.workspace.getBranches(id);
    return result.success && result.data ? result.data : [];
  },

  switchGitBranch: async (id: string, branchName: string) => {
    const api = getElectronAPI();
    if (!api) return;

    const result = await api.workspace.switchBranch(id, branchName);
    if (result.success && result.data) {
      set((state) => ({
        workspaces: state.workspaces.map((w) =>
          w.id === id ? result.data! : w
        ),
        activeWorkspace: state.activeWorkspace?.id === id ? result.data! : state.activeWorkspace,
      }));
    }
  },

  createGitBranch: async (id: string, branchName: string) => {
    const api = getElectronAPI();
    if (!api) return;

    const result = await api.workspace.createBranch(id, branchName);
    if (result.success && result.data) {
      set((state) => ({
        workspaces: state.workspaces.map((w) =>
          w.id === id ? result.data! : w
        ),
        activeWorkspace: state.activeWorkspace?.id === id ? result.data! : state.activeWorkspace,
      }));
    }
  },
}));

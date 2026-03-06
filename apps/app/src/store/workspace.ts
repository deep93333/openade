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
    //
  }
}

type WorkspaceStoreState = {
  workspaces: Workspace[];
  activeWorkspaceId: string | null;
  isLoading: boolean;
  fileTreeVersions: Record<string, number>;
  gitChangeVersions: Record<string, number>;

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
  initializeGitRepository: (id: string) => Promise<boolean>;

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

  initializeGitRepository: async (id) => {
    const api = getElectronAPI();
    if (!api) return false;
    const result = await api.workspace.initializeGit(id);
    if (result.success && result.data) {
      set((s) => ({
        workspaces: s.workspaces.map((w) => (w.id === id ? result.data! : w)),
      }));
      return true;
    }
    return false;
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

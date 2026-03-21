import { create } from "zustand";
import { getElectronAPI } from "@/lib/electron";

export type NavigationView = "files" | "changes";
export type CenterPage = "chat" | "tasks";
export type SecondaryPaneMode = "file" | "diff";
export type TaskViewMode = "list" | "kanban";

type UIStoreState = {
  activeView: NavigationView;
  centerPage: CenterPage;
  leftPanelOpen: boolean;
  rightPanelOpen: boolean;
  secondaryPane: {
    open: boolean;
    mode: SecondaryPaneMode;
    path: string | null;
    staged?: boolean;
  };
  webView: { open: boolean; url: string };

  setActiveView: (view: NavigationView) => void;
  setCenterPage: (page: CenterPage) => void;
  setLeftPanelOpen: (open: boolean) => void;
  setRightPanelOpen: (open: boolean) => void;
  openFileViewer: (path: string) => void;
  closeSecondaryPane: () => void;
  setSecondaryPaneOpen: (open: boolean) => void;
  openWebView: (url?: string) => void;
  closeWebView: () => void;
  setWebViewOpen: (open: boolean) => void;

  createBranchDialog: { open: boolean; workspaceId: string | null; query: string | null };
  openCreateBranchDialog: (workspaceId: string, query?: string) => void;
  closeCreateBranchDialog: () => void;

  apiKeyDialogOpen: boolean;
  hasApiKey: boolean;
  setApiKeyDialogOpen: (open: boolean) => void;
  checkApiKey: () => Promise<void>;

  openDiffViewer: (path: string, staged?: boolean) => void;

  agentLogDrawerOpen: boolean;
  openAgentLogDrawer: () => void;
  closeAgentLogDrawer: () => void;
  setAgentLogDrawerOpen: (open: boolean) => void;

  infoPanelOpen: boolean;
  setInfoPanelOpen: (open: boolean) => void;

  tasksViewMode: TaskViewMode;
  setTasksViewMode: (mode: TaskViewMode) => void;
  tasksWorkspaceFilter: string;
  setTasksWorkspaceFilter: (id: string) => void;
  tasksNewTaskDialogOpen: boolean;
  setTasksNewTaskDialogOpen: (open: boolean) => void;
  tasksCount: number;
  setTasksCount: (count: number) => void;
  unreadTasksCount: number;
  setUnreadTasksCount: (count: number) => void;

  skillsCount: number;
  setSkillsCount: (count: number) => void;
};

export const useUIStore = create<UIStoreState>()((set) => ({
  activeView: "files",
  centerPage: "tasks",
  leftPanelOpen: false,
  rightPanelOpen: false,
  secondaryPane: { open: false, mode: "file", path: null, staged: false },
  webView: { open: false, url: "http://localhost:3000" },

  setActiveView: (view) => set({ activeView: view }),
  setCenterPage: (page) => set({ centerPage: page }),
  setLeftPanelOpen: (open) => set({ leftPanelOpen: open }),
  setRightPanelOpen: (open) => set({ rightPanelOpen: open }),
  openFileViewer: (path) =>
    set({ secondaryPane: { open: true, mode: "file", path } }),
  closeSecondaryPane: () =>
    set((state) => ({
      secondaryPane: { ...state.secondaryPane, open: false, path: null },
    })),
  setSecondaryPaneOpen: (open) =>
    set((state) => ({
      secondaryPane: {
        ...state.secondaryPane,
        open,
        path: open ? state.secondaryPane.path : null,
      },
    })),
  openWebView: (url = "http://localhost:3000") => set({ webView: { open: true, url } }),
  closeWebView: () => set((state) => ({ webView: { ...state.webView, open: false } })),
  setWebViewOpen: (open) =>
    set((state) => ({
      webView: { ...state.webView, open },
    })),

  createBranchDialog: { open: false, workspaceId: null, query: null },
  openCreateBranchDialog: (workspaceId, query) =>
    set({ createBranchDialog: { open: true, workspaceId, query: query || null } }),
  closeCreateBranchDialog: () =>
    set({ createBranchDialog: { open: false, workspaceId: null, query: null } }),

  apiKeyDialogOpen: false,
  hasApiKey: false,
  setApiKeyDialogOpen: (open) => set({ apiKeyDialogOpen: open }),
  checkApiKey: async () => {
    const api = getElectronAPI();
    if (!api?.auth) return;
    const result = await api.auth.status();
    if (!result.success || !result.data) return;
    const { method, hasApiKey: hasKey, cliLoggedIn } = result.data;
    const isConfigured =
      (method === "api_key" && hasKey) || (method === "claude_login" && cliLoggedIn);
    set({ hasApiKey: isConfigured });
    if (!isConfigured) {
      set({ apiKeyDialogOpen: true });
    }
  },

  openDiffViewer: (path, staged) =>
    set({ secondaryPane: { open: true, mode: "diff", path, staged: staged ?? false } }),

  agentLogDrawerOpen: false,
  openAgentLogDrawer: () => set({ agentLogDrawerOpen: true }),
  closeAgentLogDrawer: () => set({ agentLogDrawerOpen: false }),
  setAgentLogDrawerOpen: (open) => set({ agentLogDrawerOpen: open }),

  infoPanelOpen: false,
  setInfoPanelOpen: (open) => set({ infoPanelOpen: open }),

  tasksViewMode: "kanban",
  setTasksViewMode: (mode) => set({ tasksViewMode: mode }),
  tasksWorkspaceFilter: "all",
  setTasksWorkspaceFilter: (id) => set({ tasksWorkspaceFilter: id }),
  tasksNewTaskDialogOpen: false,
  setTasksNewTaskDialogOpen: (open) => set({ tasksNewTaskDialogOpen: open }),
  tasksCount: 0,
  setTasksCount: (count) => set({ tasksCount: count }),
  unreadTasksCount: 0,
  setUnreadTasksCount: (count) => set({ unreadTasksCount: count }),

  skillsCount: 0,
  setSkillsCount: (count) => set({ skillsCount: count }),
}));

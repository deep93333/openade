import { create } from "zustand";
import { getElectronAPI } from "@/lib/electron";

export type NavigationView = "files" | "changes";
export type CenterPage = "chat" | "skills" | "tasks";
export type SecondaryPaneMode = "file" | "diff";

type UIStoreState = {
  activeView: NavigationView;
  centerPage: CenterPage;
  leftPanelOpen: boolean;
  rightPanelOpen: boolean;
  secondaryPane: {
    open: boolean;
    mode: SecondaryPaneMode;
    path: string | null;
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

  createBranchDialog: { open: boolean; workspaceId: string | null };
  openCreateBranchDialog: (workspaceId: string) => void;
  closeCreateBranchDialog: () => void;

  apiKeyDialogOpen: boolean;
  hasApiKey: boolean;
  setApiKeyDialogOpen: (open: boolean) => void;
  checkApiKey: () => Promise<void>;

  openDiffViewer: (path: string) => void;

  agentLogDrawerOpen: boolean;
  openAgentLogDrawer: () => void;
  closeAgentLogDrawer: () => void;
  setAgentLogDrawerOpen: (open: boolean) => void;
};

export const useUIStore = create<UIStoreState>()((set) => ({
  activeView: "files",
  centerPage: "chat",
  leftPanelOpen: true,
  rightPanelOpen: false,
  secondaryPane: { open: false, mode: "file", path: null },
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

  createBranchDialog: { open: false, workspaceId: null },
  openCreateBranchDialog: (workspaceId) =>
    set({ createBranchDialog: { open: true, workspaceId } }),
  closeCreateBranchDialog: () =>
    set({ createBranchDialog: { open: false, workspaceId: null } }),

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

  openDiffViewer: (path) =>
    set({ secondaryPane: { open: true, mode: "diff", path } }),

  agentLogDrawerOpen: false,
  openAgentLogDrawer: () => set({ agentLogDrawerOpen: true }),
  closeAgentLogDrawer: () => set({ agentLogDrawerOpen: false }),
  setAgentLogDrawerOpen: (open) => set({ agentLogDrawerOpen: open }),
}));

import { useEffect } from "react";
import { useWorkspaceStore } from "@/store/workspace";
import { useAgentStore } from "@/store/agent";
import { useUIStore } from "@/store/ui";
import { getElectronAPI } from "@/lib/electron";

export function useAppLayout() {
  const activeWorkspace = useWorkspaceStore((s) =>
    s.workspaces.find((w) => w.id === s.activeWorkspaceId) ?? null
  );
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const fetchWorkspaces = useWorkspaceStore((s) => s.fetchWorkspaces);
  const initializeActiveWorkspace = useWorkspaceStore((s) => s.initializeActiveWorkspace);
  const initAgentListeners = useAgentStore((s) => s.initListeners);
  const teardownAgentListeners = useAgentStore((s) => s.teardownListeners);
  const pendingToolApprovals = useAgentStore((s) => s.pendingToolApprovals);
  const leftPanelOpen = useUIStore((s) => s.leftPanelOpen);
  const rightPanelOpen = useUIStore((s) => s.rightPanelOpen);
  const centerPage = useUIStore((s) => s.centerPage);
  const secondaryPane = useUIStore((s) => s.secondaryPane);
  const openFileViewer = useUIStore((s) => s.openFileViewer);
  const setSecondaryPaneOpen = useUIStore((s) => s.setSecondaryPaneOpen);
  const setWebViewOpen = useUIStore((s) => s.setWebViewOpen);
  const webView = useUIStore((s) => s.webView);
  const checkApiKey = useUIStore((s) => s.checkApiKey);
  const agentLogDrawerOpen = useUIStore((s) => s.agentLogDrawerOpen);
  const setAgentLogDrawerOpen = useUIStore((s) => s.setAgentLogDrawerOpen);

  useEffect(() => {
    const init = async () => {
      await fetchWorkspaces();
      await initializeActiveWorkspace();
    };
    init();
  }, [fetchWorkspaces, initializeActiveWorkspace]);

  useEffect(() => {
    checkApiKey();
  }, [checkApiKey]);

  useEffect(() => {
    initAgentListeners();
    return () => teardownAgentListeners();
  }, [initAgentListeners, teardownAgentListeners]);

  useEffect(() => {
    if (activeWorkspaceId) {
      useAgentStore.getState().loadWorkspace(activeWorkspaceId);
    }
  }, [activeWorkspaceId]);

  useEffect(() => {
    const api = getElectronAPI();
    if (!api?.workspace?.onFilesChanged || !api?.workspace?.onGitChanged) return;
    const unsubFiles = api.workspace.onFilesChanged((payload) => {
      useWorkspaceStore.getState().notifyFilesChanged(payload.workspaceId);
    });
    const unsubGit = api.workspace.onGitChanged((payload) => {
      useWorkspaceStore.getState().notifyGitChanged(payload.workspaceId);
      if (payload.workspaceId === useWorkspaceStore.getState().activeWorkspaceId) {
        useWorkspaceStore.getState().refreshGitInfo(payload.workspaceId);
      }
    });
    return () => {
      unsubFiles();
      unsubGit();
    };
  }, []);

  const hasSecondaryPane = secondaryPane.open;
  const globalPendingApproval =
    (activeWorkspaceId ? pendingToolApprovals[activeWorkspaceId] : null) ??
    Object.values(pendingToolApprovals).find((a) => a != null) ??
    null;

  return {
    activeWorkspace,
    activeWorkspaceId,
    leftPanelOpen,
    rightPanelOpen,
    centerPage,
    secondaryPane,
    hasSecondaryPane,
    openFileViewer,
    setSecondaryPaneOpen,
    setWebViewOpen,
    webView,
    agentLogDrawerOpen,
    setAgentLogDrawerOpen,
    globalPendingApproval,
  };
}

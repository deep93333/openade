import { useEffect } from "react";
import { Group, Panel, Separator } from "react-resizable-panels";
import type { GitUnstagedChange } from "@agentide/shared";
import type { NavigationView, SecondaryPaneMode } from "@/store/ui.store";
import { Sidebar } from "@/components/sidebar";
import { AgentPanel } from "@/components/agent/agent-panel";
import { ToolApprovalBar } from "@/components/agent/tool-approval-bar";
import { FileTree } from "@/components/file-tree";
import { GitChangesPanel } from "@/components/git-changes-panel";
import { AgentSkills } from "@/components/agent-skills";
import { TasksPage } from "@/components/tasks";
import { FileViewerDrawer } from "@/components/file-viewer";
import { GitChangesDrawer } from "@/components/git-changes-drawer";
import { WebViewDrawer } from "@/components/web-view/web-view-drawer";
import { AppTopBar } from "@/components/app-top-bar";
import { BranchSwitcher } from "@/components/sidebar/branch-switcher";
import { CreateBranchDialog } from "@/components/sidebar/create-branch-dialog";
import { CommandPalette } from "@/components/command-palette";
import { TerminalPanel } from "@/components/terminal-panel";
import { ApiKeyDialog } from "@/components/api-key-dialog";
import { AgentLogDrawer } from "@/components/agent-log-drawer";
import { useWorkspaceStore } from "@/store/workspace.store";
import { useAgentStore } from "@/store/agent.store";
import { useUIStore } from "@/store/ui.store";
import { getElectronAPI } from "@/lib/electron";
import { Tabs, TabsContent, TabsList, TabsTrigger, cn, TooltipProvider } from "@agentide/ui";
import { IconExchange, IconFiles } from "@tabler/icons-react";

const EMPTY_CHANGES: GitUnstagedChange[] = [];

const PANEL_SEPARATOR_CLASS =
  "mx-0 my-2 w-1 shrink-0 cursor-col-resize rounded bg-transparent transition hover:bg-border data-resize-handle-active:bg-primary/50";

const CARD_CLASS =
  "rounded-lg bg-background/50 shadow-card backdrop-blur-xl dark:bg-base-background/50";

const TAB_TRIGGER_CLASS =
  "text-xs flex-1 h-7 data-[state=active]:bg-background/80 dark:data-[state=active]:ring-1 dark:data-[state=active]:ring-foreground/5 data-[state=active]:shadow-card dark:data-[state=active]:shadow-none";

type SecondaryPanePanelProps = {
  secondaryPane: { open: boolean; mode: SecondaryPaneMode; path: string | null };
  workspaceId: string | null;
  onOpenChange: (open: boolean) => void;
};

function SecondaryPanePanel({ secondaryPane, workspaceId, onOpenChange }: SecondaryPanePanelProps) {
  return (
    <>
      <Separator className={PANEL_SEPARATOR_CLASS} />
      <Panel id="secondary" minSize={380} maxSize="60%" defaultSize={520}>
        <div className={cn("my-2 mr-2 p-[1px] h-[calc(100%-1rem)] overflow-hidden", CARD_CLASS)}>
          {secondaryPane.mode === "file" ? (
            <FileViewerDrawer
              open={secondaryPane.open && secondaryPane.mode === "file"}
              onOpenChange={onOpenChange}
              filePath={secondaryPane.path}
              className="flex h-full min-h-0 flex-col"
            />
          ) : (
            <GitChangesDrawer
              open={secondaryPane.open && secondaryPane.mode === "changes"}
              onOpenChange={onOpenChange}
              workspaceId={workspaceId}
              changes={EMPTY_CHANGES}
              scrollToPath={secondaryPane.path}
              className="h-full"
            />
          )}
        </div>
      </Panel>
    </>
  );
}

type RightPanelProps = {
  activeView: NavigationView;
  setActiveView: (view: NavigationView) => void;
  onFileSelect: (path: string) => void;
  showSeparator: boolean;
};

function RightPanel({ activeView, setActiveView, onFileSelect, showSeparator }: RightPanelProps) {
  return (
    <>
      {showSeparator && <Separator className={PANEL_SEPARATOR_CLASS} />}
      <Panel id="right-panel" minSize={220} maxSize={360} defaultSize={260}>
        <div className="flex min-h-0 h-full flex-col overflow-hidden">
          <Tabs
            value={activeView}
            onValueChange={(v) => setActiveView(v as NavigationView)}
            className="flex h-full min-h-0 flex-col"
          >
            <div className="flex shrink-0 py-1 px-2 items-center border-b border-foreground/5 h-12 drag-region">
              <TabsList className="h-8 w-full justify-start gap-0.5">
                <TabsTrigger value="files" className={TAB_TRIGGER_CLASS}>
                  <span className="inline-flex items-center gap-1.5">
                    <IconFiles className="size-3.5" stroke={2.2} />
                    Files
                  </span>
                </TabsTrigger>
                <TabsTrigger value="changes" className={TAB_TRIGGER_CLASS}>
                  <span className="inline-flex items-center gap-1.5">
                    <IconExchange className="size-3.5" stroke={2.2} />
                    Changes
                  </span>
                </TabsTrigger>
              </TabsList>
            </div>
            <TabsContent value="files" className="mt-0 min-h-0 flex-1 overflow-hidden data-[state=inactive]:hidden">
              <FileTree className="h-full" onFileSelect={onFileSelect} />
            </TabsContent>
            <TabsContent value="changes" className="mt-0 min-h-0 flex-1 overflow-hidden data-[state=inactive]:hidden">
              <GitChangesPanel className="h-full min-h-0" onFileSelect={onFileSelect} />
            </TabsContent>
          </Tabs>
        </div>
      </Panel>
    </>
  );
}

function useAppLayout() {
  const activeWorkspace = useWorkspaceStore((s) =>
    s.workspaces.find((w) => w.id === s.activeWorkspaceId) ?? null
  );
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const initAgentListeners = useAgentStore((s) => s.initListeners);
  const teardownAgentListeners = useAgentStore((s) => s.teardownListeners);
  const pendingToolApprovals = useAgentStore((s) => s.pendingToolApprovals);
  const rightPanelOpen = useUIStore((s) => s.rightPanelOpen);
  const activeView = useUIStore((s) => s.activeView);
  const setActiveView = useUIStore((s) => s.setActiveView);
  const centerPage = useUIStore((s) => s.centerPage);
  const terminalVisible = useUIStore((s) => s.terminalVisible);
  const secondaryPane = useUIStore((s) => s.secondaryPane);
  const openFileViewer = useUIStore((s) => s.openFileViewer);
  const setSecondaryPaneOpen = useUIStore((s) => s.setSecondaryPaneOpen);
  const setWebViewOpen = useUIStore((s) => s.setWebViewOpen);
  const webView = useUIStore((s) => s.webView);
  const apiKeyDialogOpen = useUIStore((s) => s.apiKeyDialogOpen);
  const setApiKeyDialogOpen = useUIStore((s) => s.setApiKeyDialogOpen);
  const checkApiKey = useUIStore((s) => s.checkApiKey);
  const hasApiKey = useUIStore((s) => s.hasApiKey);
  const agentLogDrawerOpen = useUIStore((s) => s.agentLogDrawerOpen);
  const setAgentLogDrawerOpen = useUIStore((s) => s.setAgentLogDrawerOpen);

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
    rightPanelOpen,
    activeView,
    setActiveView,
    centerPage,
    terminalVisible,
    secondaryPane,
    hasSecondaryPane,
    openFileViewer,
    setSecondaryPaneOpen,
    setWebViewOpen,
    webView,
    apiKeyDialogOpen,
    setApiKeyDialogOpen,
    checkApiKey,
    hasApiKey,
    agentLogDrawerOpen,
    setAgentLogDrawerOpen,
    globalPendingApproval,
  };
}

export const AppLayout = () => {
  const {
    activeWorkspace,
    activeWorkspaceId,
    rightPanelOpen,
    activeView,
    setActiveView,
    centerPage,
    terminalVisible,
    secondaryPane,
    hasSecondaryPane,
    openFileViewer,
    setSecondaryPaneOpen,
    setWebViewOpen,
    webView,
    apiKeyDialogOpen,
    setApiKeyDialogOpen,
    checkApiKey,
    hasApiKey,
    agentLogDrawerOpen,
    setAgentLogDrawerOpen,
    globalPendingApproval,
  } = useAppLayout();

  const showPanelGap = hasSecondaryPane || rightPanelOpen;
  const mainContent =
    centerPage === "skills" ? (
      <AgentSkills />
    ) : centerPage === "tasks" ? (
      <TasksPage />
    ) : (
      <>
        <AppTopBar
          title={activeWorkspace?.name ?? "AgentIDE"}
          left={
            activeWorkspace?.branch ? (
              <BranchSwitcher
                workspaceId={activeWorkspace.id}
                currentBranch={activeWorkspace.branch}
              />
            ) : undefined
          }
        />
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <AgentPanel />
        </div>
        <div
          className={cn(
            "shrink-0 flex flex-col overflow-hidden border-t border-foreground/10 transition-[height] duration-200 ease-out",
            terminalVisible
              ? "h-[220px] min-h-[140px]"
              : "h-0 min-h-0 opacity-0 pointer-events-none border-t-0"
          )}
        >
          <TerminalPanel />
        </div>
      </>
    );

  return (
    <TooltipProvider>
      <div className="flex h-screen w-full min-w-0 flex-col overflow-hidden bg-tertiary dark:bg-background">
        <div className="flex min-h-0 min-w-0 flex-1 flex-row overflow-hidden bg-tertiary dark:bg-background">
          <Sidebar />
          <Group orientation="horizontal" className="min-h-0 min-w-0 flex-1 bg-tertiary dark:bg-background">
            <Panel id="main" minSize={360}>
              <div
                className={cn(
                  "py-2 flex min-w-0 h-full flex-col",
                  showPanelGap ? "pr-0" : "pr-2"
                )}
              >
                <div className={cn("flex min-h-0 flex-1 flex-col overflow-hidden", CARD_CLASS)}>
                  <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{mainContent}</div>
                </div>
              </div>
            </Panel>

            {hasSecondaryPane && (
              <SecondaryPanePanel
                secondaryPane={secondaryPane}
                workspaceId={activeWorkspaceId}
                onOpenChange={setSecondaryPaneOpen}
              />
            )}

            {rightPanelOpen && (
              <RightPanel
                activeView={activeView}
                setActiveView={setActiveView}
                onFileSelect={openFileViewer}
                showSeparator={!hasSecondaryPane}
              />
            )}
          </Group>
        </div>

        <WebViewDrawer open={webView.open} onOpenChange={setWebViewOpen} initialUrl={webView.url} />
        <CreateBranchDialog />
        <CommandPalette />
        {globalPendingApproval && (
          <div className="pointer-events-none fixed bottom-4 left-1/2 -translate-x-1/2 z-modal-dropdown w-[min(560px,calc(100vw-2rem))]">
            <div className="pointer-events-auto rounded-xl border border-foreground/10 bg-tertiary/95 shadow-popover backdrop-blur-xl">
              <ToolApprovalBar request={globalPendingApproval} />
            </div>
          </div>
        )}
        <ApiKeyDialog
          open={apiKeyDialogOpen}
          onOpenChange={setApiKeyDialogOpen}
          onSaved={() => checkApiKey()}
          dismissible={hasApiKey}
        />
        <AgentLogDrawer
          open={agentLogDrawerOpen}
          onOpenChange={setAgentLogDrawerOpen}
        />
      </div>
    </TooltipProvider>
  );
};

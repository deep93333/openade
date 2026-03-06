  import { Group, Panel } from "react-resizable-panels";
  import { AgentPanel } from "@/components/agent/panel";
  import { InfoPanel } from "@/components/agent/info-panel";
  import { ToolApprovalBar } from "@/components/agent/approval";
  import { AgentSkills } from "@/components/agent-skills";
  import { TasksPage } from "@/components/tasks";
  import { WebViewDrawer } from "@/components/web-view/drawer";
  import { AppTopBar } from "@/components/topbar";
  import { BranchSwitcher } from "@/components/sidebar/branches";
  import { CreateBranchDialog } from "@/components/sidebar/branch";
  import { CommandPalette } from "@/components/palette";
  import { ApiKeyDialog } from "@/components/apikeys";
  import { AgentLogDrawer } from "@/components/logdrawer";
  import { cn, TooltipProvider } from "@agentide/ui";
  import { SecondaryPanePanel } from "./secondary-pane-panel";
  import { RightPanel } from "./right-panel";
  import { useAppLayout } from "./use-app-layout";
  import { CARD_CLASS } from "./constants";
  import { useUIStore } from "@/store/ui";

  export const AppLayout = () => {
    const {
      activeWorkspace,
      rightPanelOpen,
      activeView,
      setActiveView,
      centerPage,
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

    const infoPanelOpen = useUIStore((s) => s.infoPanelOpen);
    const setInfoPanelOpen = useUIStore((s) => s.setInfoPanelOpen);

    const showPanelGap = hasSecondaryPane || rightPanelOpen;
    const mainContent =
      centerPage === "skills" ? (
        <AgentSkills />
      ) : centerPage === "tasks" ? (
        <TasksPage />
      ) : (
        <>
        
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <AgentPanel />
          </div>
        </>
      );

    return (
      <TooltipProvider>
        <div className="flex h-screen w-full min-w-0 flex-col overflow-hidden bg-tertiary dark:bg-background">
          <AppTopBar />
          <div className="flex min-h-0 min-w-0 gap-1 flex-1 flex-row overflow-hidden bg-tertiary dark:bg-background">
            <Group orientation="horizontal" className="min-h-0 min-w-0 gap-1.5 px-1.5 pb-1.5 flex-1 bg-tertiary dark:bg-background gap-0">
              <Panel id="main" minSize={360}>
                <div
                  className={cn(
                    "flex min-w-0 h-full flex-col",
                
                  )}
                >
                  <div
                    className={cn("flex min-h-0 flex-1 flex-col overflow-hidden", CARD_CLASS)}
                   
                  >
                      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{mainContent}</div>
                  </div>
                </div>
              </Panel>

              {hasSecondaryPane && (
                <SecondaryPanePanel
                  secondaryPane={secondaryPane}
                  onOpenChange={setSecondaryPaneOpen}
                />
              )}

              {rightPanelOpen && (
                                <div className={cn("flex min-h-0 flex-row overflow-hidden", CARD_CLASS)}>

                <RightPanel
                  activeView={activeView}
                  setActiveView={setActiveView}
                  onFileSelect={openFileViewer}
                  showSeparator={!hasSecondaryPane}
                />
                </div>
              )}
            </Group>
          </div>

          <WebViewDrawer open={webView.open} onOpenChange={setWebViewOpen} initialUrl={webView.url} />
          <CreateBranchDialog />
          <CommandPalette />
          {globalPendingApproval && (
            <div className="pointer-events-none fixed bottom-4 pt-2 left-1/2 -translate-x-1/2 z-modal-dropdown w-[min(560px,calc(100vw-2rem))]">
              <div className="pointer-events-auto rounded-xl bg-background pt-1 shadow-popover">
                <ToolApprovalBar request={globalPendingApproval} />
              </div>
            </div>
          )}
          <ApiKeyDialog
            open={apiKeyDialogOpen}
            onOpenChange={setApiKeyDialogOpen}
            onSaved={() => checkApiKey()}
          />
          <AgentLogDrawer
            open={agentLogDrawerOpen}
            onOpenChange={setAgentLogDrawerOpen}
          />
          <InfoPanel
            open={infoPanelOpen}
            onOpenChange={setInfoPanelOpen}
          />
        </div>
      </TooltipProvider>
    );
  };

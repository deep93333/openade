import { Group, Panel } from "react-resizable-panels";
import { Sidebar } from "@/components/sidebar";
import { AgentPanel } from "@/components/agent/agent-panel";
import { ToolApprovalBar } from "@/components/agent/tool-approval-bar";
import { AgentSkills } from "@/components/agent-skills";
import { TasksPage } from "@/components/tasks";
import { WebViewDrawer } from "@/components/web-view/web-view-drawer";
import { AppTopBar } from "@/components/app-top-bar";
import { BranchSwitcher } from "@/components/sidebar/branch-switcher";
import { CreateBranchDialog } from "@/components/sidebar/create-branch-dialog";
import { CommandPalette } from "@/components/command-palette";
import { ApiKeyDialog } from "@/components/api-key-dialog";
import { AgentLogDrawer } from "@/components/agent-log-drawer";
import { cn, TooltipProvider } from "@agentide/ui";
import { SecondaryPanePanel } from "./secondary-pane-panel";
import { RightPanel } from "./right-panel";
import { useAppLayout } from "./use-app-layout";
import { CARD_CLASS } from "./constants";

export const AppLayout = () => {
  const {
    activeWorkspace,
    leftPanelOpen,
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
        />
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <AgentPanel />
        </div>
      </>
    );

  return (
    <TooltipProvider>
      <div className="flex h-screen w-full min-w-0 flex-col overflow-hidden bg-tertiary dark:bg-background">
        <div className="flex min-h-0 min-w-0 flex-1 flex-row overflow-hidden bg-tertiary dark:bg-background">
          {leftPanelOpen && <Sidebar />}
          <Group orientation="horizontal" className="min-h-0 min-w-0 flex-1 bg-tertiary dark:bg-background gap-0.5">
            <Panel id="main" minSize={360}>
              <div
                className={cn(
                  "py-2 flex min-w-0 h-full flex-col",
                  showPanelGap ? "pr-0" : "pr-2",
                  leftPanelOpen ? "pl-0" : "pl-2"
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

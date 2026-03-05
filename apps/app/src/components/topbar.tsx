import { useWorkspaceStore } from "@/store/workspace";
import { useAgentStore } from "@/store/agent";
import { cn, Button } from "@agentide/ui";
import { IconBrowser, IconInfoCircle, IconLayoutSidebar, IconLayoutSidebarRight } from "@tabler/icons-react";
import { useUIStore } from "@/store/ui";
import type { ReactNode } from "react";

type AppTopBarProps = {
  left?: ReactNode;
  right?: ReactNode;
};

export function AppTopBar({ left, right }: AppTopBarProps) {
  const leftPanelOpen = useUIStore((s) => s.leftPanelOpen);
  const setLeftPanelOpen = useUIStore((s) => s.setLeftPanelOpen);
  const rightPanelOpen = useUIStore((s) => s.rightPanelOpen);
  const setRightPanelOpen = useUIStore((s) => s.setRightPanelOpen);
  const webViewOpen = useUIStore((s) => s.webView.open);
  const openWebView = useUIStore((s) => s.openWebView);
  const infoPanelOpen = useUIStore((s) => s.infoPanelOpen);
  const setInfoPanelOpen = useUIStore((s) => s.setInfoPanelOpen);

  const workspaces = useWorkspaceStore((s) => s.workspaces);
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const selectWorkspace = useWorkspaceStore((s) => s.selectWorkspace);

  const handleSelectWorkspace = async (id: string) => {
    if (id === activeWorkspaceId) return;
    await selectWorkspace(id);
    useAgentStore.getState().loadWorkspace(id);
  };

  return (
    <div className="flex h-10 draggable shrink-0 items-center justify-between gap-2 pl-20 pr-2 drag-region">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={() => setLeftPanelOpen(!leftPanelOpen)}
          aria-label={leftPanelOpen ? "Collapse left sidebar" : "Expand left sidebar"}
          className="not-draggable shrink-0"
        >
          <IconLayoutSidebar stroke={1} className="h-4 w-4" />
        </Button>

        {workspaces.length > 0 ? (
          <div className=" flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto scrollbar-none">
            <div className="flex flex-row not-draggable  bg-foreground/5 rounded-full p-0.5 items-center gap-0.5">
            {workspaces.map((ws) => {
              const isActive = ws.id === activeWorkspaceId;
              return (
                <Button
                  key={ws.id}
                  type="button"
                  size="xs"
                  rounded="full"
                  className="rounded-full!"
                  variant={isActive ? "bordered" : "ghost"}
                  onClick={() => handleSelectWorkspace(ws.id)}
                  
                >
                  <span className="max-w-[160px] truncate">{ws.name}</span>
                </Button>
              );
            })}
            </div>
          </div>
        ) : (
          <span className="shrink-0 text-sm font-semibold text-foreground">AgentIDE</span>
        )}

        {left != null && <div className="not-draggable shrink-0">{left}</div>}
      </div>

      <div className="not-draggable shrink-0 flex flex-row items-center gap-1">
        {right}
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={() => openWebView()}
          aria-label="Open web view"
          title="Open web view"
          className={!webViewOpen ? "text-muted-foreground" : undefined}
        >
          <IconBrowser stroke={1} className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={() => setInfoPanelOpen(!infoPanelOpen)}
          aria-label={infoPanelOpen ? "Close thread info" : "View thread info"}
          title="Thread Inspector"
          className={infoPanelOpen ? "text-blue-500" : undefined}
        >
          <IconInfoCircle stroke={1} className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={() => setRightPanelOpen(!rightPanelOpen)}
          aria-label={rightPanelOpen ? "Collapse right panel" : "Expand right panel"}
        >
          <IconLayoutSidebarRight stroke={1} className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

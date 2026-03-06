import { useState } from "react";
import { useWorkspaceStore } from "@/store/workspace";
import { useAgentStore } from "@/store/agent";
import { cn, Button } from "@agentide/ui";
import { IconBrowser, IconInfoCircle, IconLayoutSidebar, IconLayoutSidebarRight, IconPlus } from "@tabler/icons-react";
import { useUIStore } from "@/store/ui";
import { CreateWorkspaceDialog } from "./sidebar/project";
import type { ReactNode } from "react";
import { useGitStatus } from "@/hooks/use-git-changes";

type AppTopBarProps = {
  left?: ReactNode;
  right?: ReactNode;
};

function GitStatusBadge() {
  const activeWorkspace = useWorkspaceStore((s) => s.activeWorkspace);
  const { staged, unstaged, aheadCount, loading } = useGitStatus();
  const setActiveView = useUIStore((s) => s.setActiveView);

  if (!activeWorkspace?.isGitRepository) return null;

  const totalFiles = staged.length + unstaged.length;
  const totalAdded = [...staged, ...unstaged].reduce((s, c) => s + c.added, 0);
  const totalDeleted = [...staged, ...unstaged].reduce((s, c) => s + c.deleted, 0);

  const hasChanges = totalFiles > 0;
  const hasStagedOnly = staged.length > 0 && unstaged.length === 0;
  const hasAhead = aheadCount > 0;

  if (loading || (!hasChanges && !hasAhead)) return null;

  return (
    <button
      type="button"
      onClick={() => setActiveView("changes")}
      className={cn(
        "flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-medium transition-colors cursor-pointer",
        "bg-foreground/6 hover:bg-foreground/10 text-muted-foreground hover:text-foreground"
      )}
      title="Open Git Changes"
    >
      {/* File count */}
      {hasChanges && (
        <span className="flex items-center gap-1">
          <span>{totalFiles} {totalFiles === 1 ? "file" : "files"}</span>

          {/* +/- diff stats */}
          {(totalAdded > 0 || totalDeleted > 0) && (
            <span className="flex items-center gap-0.5">
              {totalAdded > 0 && <span className="text-emerald-600">+{totalAdded}</span>}
              {totalDeleted > 0 && <span className="text-rose-400">-{totalDeleted}</span>}
            </span>
          )}

          {/* Staged pill */}
          {hasStagedOnly ? (
            <span className="rounded-full bg-blue-300/15 px-1.5 py-px text-blue-500 dark:text-blue-400">
              staged
            </span>
          ) : staged.length > 0 ? (
            <span className="rounded-full bg-blue-300/15 px-1.5 py-px text-blue-500 dark:text-blue-400">
              {staged.length} staged
            </span>
          ) : null}
        </span>
      )}

      {/* Separator when both changes and ahead */}
      {hasChanges && hasAhead && <span className="opacity-30">·</span>}

      {/* Unpushed commits */}
      {hasAhead && (
        <span className="flex items-center gap-1 text-amber-500 dark:text-amber-400">
          <svg className="size-2.5" viewBox="0 0 12 12" fill="none" aria-hidden="true">
            <path d="M6 1v10M6 1l-3 3M6 1l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {aheadCount} to push
        </span>
      )}
    </button>
  );
}

export function AppTopBar({ left, right }: AppTopBarProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);

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
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => setIsDialogOpen(true)}
              aria-label="Add new workspace"
              title="Add new workspace"
              className="not-draggable shrink-0 ml-1"
            >
              <IconPlus stroke={1} className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <span className="shrink-0 text-sm font-semibold text-foreground">AgentIDE</span>
        )}

        {left != null && <div className="not-draggable shrink-0">{left}</div>}
      </div>

      <div className="not-draggable shrink-0 flex flex-row items-center gap-1">
        {right}
        <GitStatusBadge />
        
        {/* Right panel tabs */}
        <div className="flex flex-row bg-foreground/5 rounded-full p-0.5 items-center gap-0.5">
          <Button
            variant={webViewOpen ? "bordered" : "ghost"}
            size="xs"
            rounded="full"
            onClick={() => openWebView()}
            aria-label="Open web view"
            title="Browser"
          >
            Browser
          </Button>
          <Button
            variant={infoPanelOpen ? "bordered" : "ghost"}
            size="xs"
            rounded="full"
            onClick={() => setInfoPanelOpen(!infoPanelOpen)}
            aria-label={infoPanelOpen ? "Close thread info" : "View thread info"}
            title="Thread Inspector"
          >
            Info
          </Button>
          <Button
            variant={rightPanelOpen ? "bordered" : "ghost"}
            size="xs"
            rounded="full"
            onClick={() => setRightPanelOpen(!rightPanelOpen)}
            aria-label={rightPanelOpen ? "Collapse right panel" : "Expand right panel"}
            title="Changes"
          >
            Changes
          </Button>
        </div>
      </div>

      <CreateWorkspaceDialog isOpen={isDialogOpen} onClose={() => setIsDialogOpen(false)} />
    </div>
  );
}

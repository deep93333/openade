import { useState } from "react";
import { useWorkspaceStore } from "@/store/workspace";
import { useAgentStore } from "@/store/agent";
import { cn, Button, ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from "@openade/ui";
import {
  IconArrowLeft,
  IconExchange,
  IconFiles,
  IconLayoutSidebarRight,
  IconList,
  IconPlus,
  IconSettings2,
} from "@tabler/icons-react";
import { useUIStore } from "@/store/ui";
import { CreateWorkspaceDialog } from "./sidebar/project";
import type { ReactNode } from "react";
import { useGitStatus } from "@/hooks/use-git-changes";
import type { Workspace } from "@openade/shared";

type AppTopBarProps = {
  left?: ReactNode;
  right?: ReactNode;
  onRemoveWorkspace?: (workspace: Workspace) => void;
};

function GitStatusBadge() {
  const activeWorkspace = useWorkspaceStore((s) => s.activeWorkspace);
  const { staged, unstaged, aheadCount, loading } = useGitStatus();
  const setActiveView = useUIStore((s) => s.setActiveView);
  const setRightPanelOpen = useUIStore((s) => s.setRightPanelOpen);

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
      onClick={() => {
        setActiveView("changes");
        setRightPanelOpen(true);
      }}
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

export function AppTopBar({ left, right, onRemoveWorkspace }: AppTopBarProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const activeView = useUIStore((s) => s.activeView);
  const setActiveView = useUIStore((s) => s.setActiveView);
  const rightPanelOpen = useUIStore((s) => s.rightPanelOpen);
  const setRightPanelOpen = useUIStore((s) => s.setRightPanelOpen);
  const centerPage = useUIStore((s) => s.centerPage);
  const setCenterPage = useUIStore((s) => s.setCenterPage);

  const workspaces = useWorkspaceStore((s) => s.workspaces);
  const agentWorkspaces = useAgentStore((s) => s.workspaces);
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const selectWorkspace = useWorkspaceStore((s) => s.selectWorkspace);

  const isSettingsPage = centerPage === "settings";

  const handleSelectWorkspace = async (id: string) => {
    if (id === activeWorkspaceId) return;
    await selectWorkspace(id);
    useAgentStore.getState().loadWorkspace(id);
  };

  return (
    <div className="flex h-10 draggable shrink-0 items-center justify-between gap-2 px-2 drag-region">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        {isSettingsPage ? (
          <div className="flex items-center gap-1.5 not-draggable">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCenterPage("chat")}
              aria-label="Back"
              title="Back"
              className="gap-1"
            >
              <IconArrowLeft stroke={1.5} className="size-4" />
              Back
            </Button>
          </div>
        ) : workspaces.length > 0 ? (
          <div className=" flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto scrollbar-none">
            <div className="flex flex-row not-draggable rounded-md items-center gap-0.5">
              {workspaces.map((ws) => {
                const isActive = ws.id === activeWorkspaceId;
                const unreadCount = (agentWorkspaces[ws.id]?.threads ?? []).reduce((count, thread) => {
                  const updatedAt = thread.updatedAt ?? thread.createdAt;
                  const lastReadAt = thread.lastReadAt ?? thread.createdAt;
                  const isUnread = updatedAt > lastReadAt;
                  const runtime = agentWorkspaces[ws.id]?.threadRuntime?.[thread.id];
                  const isActive = runtime?.status === "running" && !!runtime?.sessionId;
                  return isUnread && !isActive ? count + 1 : count;
                }, 0);
                return (
                  <ContextMenu key={ws.id}>
                    <ContextMenuTrigger asChild>
                      <Button
                        type="button"
                        size="sm"
                        className="gap-1 overflow-hidden"
                        variant={isActive ? "secondary" : "ghost"}
                        onClick={() => handleSelectWorkspace(ws.id)}
                      >
                        <span className="max-w-[160px] truncate">{ws.name}</span>
                        {unreadCount > 0 && (
                          <span className="inline-flex min-w-4 items-center justify-center rounded-full bg-accent px-1.5 text-[10px] leading-4 text-light">
                            {unreadCount}
                          </span>
                        )}
                      </Button>
                    </ContextMenuTrigger>
                    <ContextMenuContent>
                      <ContextMenuItem onClick={() => handleSelectWorkspace(ws.id)}>Open</ContextMenuItem>
                      <ContextMenuItem
                        onClick={() => onRemoveWorkspace?.(ws)}
                        className="text-rose-500 focus:text-rose-500"
                      >
                        Remove
                      </ContextMenuItem>
                    </ContextMenuContent>
                  </ContextMenu>
                );
              })}
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setIsDialogOpen(true)}
              aria-label="Add new workspace"
              title="Add new workspace"
              className="not-draggable shrink-0 ml-1"
            >
              <IconPlus stroke={1} className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <span className="shrink-0 text-sm font-semibold text-foreground">Openade</span>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setIsDialogOpen(true)}
              aria-label="Add workspace"
              title="Add workspace"
              className="not-draggable shrink-0 gap-1"
            >
              <IconPlus stroke={1} className="h-4 w-4" />
              Add workspace
            </Button>
          </div>
        )}

        {left != null && <div className="not-draggable shrink-0">{left}</div>}
      </div>

      {!isSettingsPage && (
        <div className="not-draggable shrink-0 flex flex-row items-center gap-1">
          {right}
          <GitStatusBadge />
          <div className="flex flex-row items-center gap-0.5">
            <Button
              variant={centerPage === "tasks" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setCenterPage("tasks")}
              aria-label="Open tasks"
              title="Tasks"
            >
              <IconList stroke={1} className="size-4" />
              Tasks
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCenterPage("settings")}
              aria-label="Open settings"
              title="Settings"
            >
              <IconSettings2 stroke={1} className="size-4" />
              Settings
            </Button>
          </div>
          <div className="flex flex-row items-center gap-0.5">
            <Button
              variant={rightPanelOpen && activeView === "files" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => {
                setActiveView("files");
                setRightPanelOpen(true);
              }}
              aria-label="Open files sidebar"
              title="Files"
              className="gap-1"
            >
              <IconFiles stroke={1} className="size-4" />
              Files
            </Button>
            <Button
              variant={rightPanelOpen && activeView === "changes" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => {
                setActiveView("changes");
                setRightPanelOpen(true);
              }}
              aria-label="Open git changes"
              title="Changes"
              className="gap-1"
            >
              <IconExchange stroke={1} className="size-4" />
              Changes
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setRightPanelOpen(!rightPanelOpen)}
              aria-label={rightPanelOpen ? "Hide sidebar" : "Show sidebar"}
              title={rightPanelOpen ? "Hide sidebar" : "Show sidebar"}
            >
              <IconLayoutSidebarRight stroke={1} className="size-4" />
            </Button>
          </div>
        </div>
      )}

      <CreateWorkspaceDialog isOpen={isDialogOpen} onClose={() => setIsDialogOpen(false)} />
    </div>
  );
}

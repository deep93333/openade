import { useCallback, useEffect, useRef, useState } from "react";
import type { GitStagedChange, GitUnstagedChange, IpcResult } from "@agentide/shared";
import { Button, PlusIcon, Tabs, TabsContent, TabsList, TabsTrigger } from "@agentide/ui";
import { IconLoader } from "@tabler/icons-react";
import { getElectronAPI } from "@/lib/electron";
import { useWorkspaceStore } from "@/store/workspace.store";
import { cn } from "@/lib/cn";
import { GitChangesDrawer } from "@/components/git-changes-drawer";
import { GitCommitDialog } from "@/components/git-commit-dialog";
import { getFileTypeIcon } from "@/components/file-tree/file-icons";

type GitChangesPanelProps = {
  className?: string;
  onFileSelect?: (path: string) => void;
};

function dirname(path: string): string {
  const i = path.lastIndexOf("/");
  return i <= 0 ? "" : path.slice(0, i);
}

function basename(path: string): string {
  const i = path.lastIndexOf("/");
  return i < 0 ? path : path.slice(i + 1);
}

type ChangeRowProps = {
  path: string;
  added: number;
  deleted: number;
  workspacePath: string;
  onOpenDrawer?: (path: string) => void;
  action: "stage" | "unstage";
  onAction: (path: string) => void;
  actionLabel: string;
  actionLoading?: boolean;
};

function ChangeRow({
  path,
  added,
  deleted,
  workspacePath,
  onOpenDrawer,
  action,
  onAction,
  actionLabel,
  actionLoading,
}: ChangeRowProps) {
  const dir = dirname(path);
  const name = basename(path);
  return (
    <div className="flex group/change-row items-center relative gap-2 rounded-md px-2 py-1.5 group hover:bg-foreground/10">
      <button
        type="button"
        onClick={() => onOpenDrawer?.(path)}
        className="flex min-w-0 flex-1 relative flex-col items-start gap-0.5 text-left text-sm"
      >
        <div className="flex w-full items-center gap-1 flex-1">
          {getFileTypeIcon(name)}
          <span className="min-w-0 shrink-0 truncate font-medium text-xs text-foreground flex-1">{name}</span>
          <div className="flex shrink-0 items-center gap-1">
            {added > 0 && (
              <span className="rounded bg-green-500/15 px-1.5 py-0.5 text-[10px] font-medium text-green-700 dark:text-green-400">
                +{added}
              </span>
            )}
            {deleted > 0 && (
              <span className="rounded bg-red-500/15 px-1.5 py-0.5 text-[10px] font-medium text-red-700 dark:text-red-400">
                -{deleted}
              </span>
            )}
          </div>
        </div>
        {/* {dir ? (
          <span className="ml-1.5 truncate text-xs text-muted-foreground" dir="rtl">
            {dir}/
          </span>
        ) : null} */}
      </button>
      <div className="absolute flex px-1 items-center justify-center group-hover/change-row:opacity-100 opacity-0 transition-opacity right-0 top-0 bottom-0">
      <Button
      tooltip={actionLabel}
        size="icon-xs"
        variant="bordered"
        disabled={actionLoading}
        onClick={() => onAction(path)}
      >
        <PlusIcon/>
      </Button>
      </div>
    </div>
  );
}

export const GitChangesPanel = ({ className, onFileSelect: _onFileSelect }: GitChangesPanelProps) => {
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const activeWorkspace = useWorkspaceStore((s) =>
    s.workspaces.find((w) => w.id === s.activeWorkspaceId) ?? null
  );
  const gitChangeVersion = useWorkspaceStore((s) =>
    activeWorkspaceId ? (s.gitChangeVersions[activeWorkspaceId] ?? 0) : 0
  );
  const [staged, setStaged] = useState<GitStagedChange[]>([]);
  const [changes, setChanges] = useState<GitUnstagedChange[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerScrollToPath, setDrawerScrollToPath] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"staged" | "unstaged">("unstaged");
  const [commitDialogOpen, setCommitDialogOpen] = useState(false);
  const [stageLoading, setStageLoading] = useState<string | null>(null);
  const [unstageLoading, setUnstageLoading] = useState<string | null>(null);
  const [stageAllLoading, setStageAllLoading] = useState(false);
  const hasLoadedOnceRef = useRef(false);

  const load = useCallback(async () => {
    if (!activeWorkspace?.id) {
      setStaged([]);
      setChanges([]);
      return;
    }
    const api = getElectronAPI();
    if (!api) {
      setStaged([]);
      setChanges([]);
      setError("Not available in browser");
      return;
    }
    const isInitial = !hasLoadedOnceRef.current;
    if (isInitial) setLoading(true);
    else setRefreshing(true);
    setError(null);
    try {
      const timeoutMs = 8000;
      const [unstagedRes, stagedRes] = await Promise.all([
        Promise.race([
          api.workspace.getUnstagedChanges(activeWorkspace.id),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error("Request timed out")), timeoutMs)
          ),
        ]),
        Promise.race([
          api.workspace.getStagedChanges(activeWorkspace.id),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error("Request timed out")), timeoutMs)
          ),
        ]),
      ]);
      if (unstagedRes.success && unstagedRes.data) setChanges(unstagedRes.data);
      else setChanges([]);
      if (stagedRes.success && stagedRes.data) setStaged(stagedRes.data);
      else setStaged([]);
      if (!unstagedRes.success && "error" in unstagedRes && unstagedRes.error) setError(unstagedRes.error);
      else if (!stagedRes.success && "error" in stagedRes && stagedRes.error) setError(stagedRes.error);
      hasLoadedOnceRef.current = true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load changes");
      setStaged([]);
      setChanges([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeWorkspace?.id]);

  useEffect(() => {
    hasLoadedOnceRef.current = false;
  }, [activeWorkspaceId]);

  useEffect(() => {
    load();
  }, [load, gitChangeVersion]);

  const handleStage = useCallback(
    async (path: string) => {
      const api = getElectronAPI();
      const stage = (api?.workspace as { stageFile?: (w: string, p: string) => Promise<{ success?: boolean }> } | undefined)?.stageFile;
      if (!stage || !activeWorkspace?.id) return;
      setStageLoading(path);
      const result = await stage(activeWorkspace.id, path);
      setStageLoading(null);
      if (result?.success) load();
    },
    [activeWorkspace?.id, load]
  );

  const handleUnstage = useCallback(
    async (path: string) => {
      const api = getElectronAPI();
      const unstage = (api?.workspace as { unstageFile?: (w: string, p: string) => Promise<{ success?: boolean }> } | undefined)?.unstageFile;
      if (!unstage || !activeWorkspace?.id) return;
      setUnstageLoading(path);
      const result = await unstage(activeWorkspace.id, path);
      setUnstageLoading(null);
      if (result?.success) load();
    },
    [activeWorkspace?.id, load]
  );

  const handleStageAll = useCallback(async () => {
    const api = getElectronAPI();
    const stage = (api?.workspace as { stageFile?: (w: string, p: string) => Promise<{ success?: boolean }> } | undefined)?.stageFile;
    if (!stage || !activeWorkspace?.id || changes.length === 0) return;
    setStageAllLoading(true);
    for (const c of changes) {
      await stage(activeWorkspace.id, c.path);
    }
    setStageAllLoading(false);
    load();
  }, [activeWorkspace?.id, changes, load]);

  const openDrawer = useCallback((path: string | null) => {
    setDrawerScrollToPath(path);
    setDrawerOpen(true);
  }, []);

  const handleDrawerOpenChange = useCallback((open: boolean) => {
    setDrawerOpen(open);
    if (!open) setDrawerScrollToPath(null);
  }, []);

  if (!activeWorkspace) {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center gap-2 py-8 text-sm text-muted-foreground",
          className
        )}
      >
        No workspace selected
      </div>
    );
  }

  if (loading) {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center gap-2 py-8 text-sm text-muted-foreground",
          className
        )}
      >
        Loading changes...
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn("flex flex-col gap-2 p-4", className)}>
        <p className="text-sm text-destructive">{error}</p>
        <button
          type="button"
          onClick={() => { setError(null); load(); }}
          className="text-xs text-accent hover:underline"
        >
          Retry
        </button>
      </div>
    );
  }

  const workspacePath = activeWorkspace.path;
  const hasStaged = staged.length > 0;
  const hasChanges = changes.length > 0;
  const hasAny = hasStaged || hasChanges;

  return (
    <div className={cn("flex flex-col overflow-hidden", className)}>
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "staged" | "unstaged")} className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="shrink-0 px-2 py-0.5 border-b border-foreground/5">
          <TabsList className="w-full justify-start gap-0.5 bg-transparent p-0">
            <TabsTrigger value="staged" className="flex-1 text-xs">
              Staged {hasStaged ? `(${staged.length})` : ""}
            </TabsTrigger>
            <TabsTrigger value="unstaged" className="flex-1 text-xs">
              Unstaged {hasChanges ? `(${changes.length})` : ""}
            </TabsTrigger>
            {refreshing && (
              <span className="flex items-center gap-1 text-[10px] text-muted-foreground px-1">
                <IconLoader className="size-3 animate-spin" />
                Updating…
              </span>
            )}
          </TabsList>
        </div>

        <TabsContent value="staged" className="mt-0 flex min-h-0 flex-1 flex-col overflow-hidden data-[state=inactive]:hidden">
          {hasStaged ? (
            <>
              <div className="shrink-0 flex gap-2 p-2">
                <Button
                  size="sm"
                  variant="secondary"
                  className="flex-1"
                  onClick={() => openDrawer(null)}
                >
                  Review all
                </Button>
                <Button
                  size="sm"
                  className="flex-1"
                  onClick={() => setCommitDialogOpen(true)}
                >
                  Commit Changes
                </Button>
              </div>
              <div className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-1.5">
                {staged.map((c) => (
                  <ChangeRow
                    key={c.path}
                    path={c.path}
                    added={c.added}
                    deleted={c.deleted}
                    workspacePath={workspacePath}
                    onOpenDrawer={openDrawer}
                    action="unstage"
                    onAction={handleUnstage}
                    actionLabel="Unstage"
                    actionLoading={unstageLoading === c.path}
                  />
                ))}
              </div>
            </>
          ) : (
            <p className="py-4 text-center text-xs text-muted-foreground">No staged changes</p>
          )}
        </TabsContent>
        <TabsContent value="unstaged" className="mt-0 flex min-h-0 flex-1 flex-col overflow-hidden data-[state=inactive]:hidden">
          {hasChanges ? (
            <>
              <div className="shrink-0 flex items-center justify-end gap-1 px-2 py-1.5">
                <Button
                  size="sm"
                  variant="secondary"
                  className="w-full"
                  disabled={stageAllLoading}
                  onClick={handleStageAll}
                >
                  {stageAllLoading ? "Staging…" : "Stage all"}
                </Button>
              </div>
              <div className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-2">
                {changes.map((c) => (
                  <ChangeRow
                    key={c.path}
                    path={c.path}
                    added={c.added}
                    deleted={c.deleted}
                    workspacePath={workspacePath}
                    onOpenDrawer={openDrawer}
                    action="stage"
                    onAction={handleStage}
                    actionLabel="Stage"
                    actionLoading={stageLoading === c.path}
                  />
                ))}
              </div>
            </>
          ) : (
            <p className="py-4 text-center text-xs text-muted-foreground">No unstaged changes</p>
          )}
        </TabsContent>
      </Tabs>

   

      <GitChangesDrawer
        open={drawerOpen}
        onOpenChange={handleDrawerOpenChange}
        workspaceId={activeWorkspace.id}
        changes={changes}
        onRevert={load}
        scrollToPath={drawerScrollToPath}
      />

      <GitCommitDialog
        open={commitDialogOpen}
        onOpenChange={setCommitDialogOpen}
        workspaceId={activeWorkspace.id}
        stagedChanges={staged}
        branchName={activeWorkspace.branch}
        onSuccess={load}
      />
    </div>
  );
};

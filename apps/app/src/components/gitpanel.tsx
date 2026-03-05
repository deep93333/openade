import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ElectronAPI, GitStagedChange, GitUnstagedChange, IpcResult } from "@agentide/shared";
import {
  Button,
  PlusIcon,
  Textarea,
  CircleCheckIcon,
  cn,
} from "@agentide/ui";
import {
  IconArrowBackUp,
  IconChevronDown,
  IconChevronRight,
  IconGitCommit,
  IconLoader,
  IconMinus,
  IconRefresh,
  IconUpload,
} from "@tabler/icons-react";
import { getElectronAPI } from "@/lib/electron";
import { useWorkspaceStore } from "@/store/workspace";
import { useUIStore } from "@/store/ui";
import { FileName, basename, DiffStats } from "@/components/primitives";

type GitChangesPanelProps = {
  className?: string;
  onFileSelect?: (path: string) => void;
};

type ChangeFile = { path: string; added: number; deleted: number };

type DirGroup = {
  dir: string;
  files: ChangeFile[];
};

function groupByDirectory(files: ChangeFile[]): DirGroup[] {
  const map = new Map<string, ChangeFile[]>();
  for (const f of files) {
    const i = f.path.lastIndexOf("/");
    const dir = i <= 0 ? "" : f.path.slice(0, i);
    const list = map.get(dir);
    if (list) list.push(f);
    else map.set(dir, [f]);
  }
  const groups: DirGroup[] = [];
  for (const [dir, dirFiles] of map) {
    groups.push({ dir, files: dirFiles });
  }
  groups.sort((a, b) => a.dir.localeCompare(b.dir));
  return groups;
}

type FileRowProps = {
  file: ChangeFile;
  onSelect: (path: string) => void;
  isSelected: boolean;
  action: "stage" | "unstage";
  onAction: (path: string) => void;
  actionLoading?: boolean;
  onRevert?: (path: string) => void;
  revertLoading?: boolean;
};

function FileRow({
  file,
  onSelect,
  isSelected,
  action,
  onAction,
  actionLoading,
  onRevert,
  revertLoading,
}: FileRowProps) {
  return (
    <div
      className={cn(
        "flex group/row items-center gap-1.5 rounded-sm px-2 py-1 cursor-pointer hover:bg-foreground/5 transition-colors",
        isSelected && "bg-foreground/8"
      )}
      onClick={() => onSelect(file.path)}
    >
      <FileName path={file.path} nameClassName="text-xs text-foreground" className="min-w-0 flex-1" />
      
      <div className="flex items-center gap-0.5 shrink-0">
        <div className="flex items-center gap-0.5 opacity-0 group-hover/row:opacity-100 transition-opacity ml-0.5">
          {action === "stage" && onRevert && (
            <Button
              tooltip="Revert"
              size="icon-xs"
              variant="ghost"
              disabled={revertLoading}
              onClick={(e) => { e.stopPropagation(); onRevert(file.path); }}
              className="size-5"
            >
              <IconArrowBackUp className="size-3" />
            </Button>
          )}
          <Button
            tooltip={action === "stage" ? "Stage" : "Unstage"}
            size="icon-xs"
            variant="ghost"
            disabled={actionLoading}
            onClick={(e) => { e.stopPropagation(); onAction(file.path); }}
            className="size-5"
          >
            {action === "stage" ? <PlusIcon className="size-3" /> : <IconMinus className="size-3" />}
          </Button>
        </div>
      </div>
    </div>
  );
}

type GroupedFileListProps = {
  files: ChangeFile[];
  onSelect: (path: string) => void;
  selectedPath: string | null;
  action: "stage" | "unstage";
  onAction: (path: string) => void;
  actionLoadingPath: string | null;
  onRevert?: (path: string) => void;
  revertLoadingPath: string | null;
};

function GroupedFileList({
  files,
  onSelect,
  selectedPath,
  action,
  onAction,
  actionLoadingPath,
  onRevert,
  revertLoadingPath,
}: GroupedFileListProps) {
  const groups = useMemo(() => groupByDirectory(files), [files]);

  return (
    <div className="flex flex-col px-2">
      {groups.map((group) => (
        <div key={group.dir || "__root"}>
          {group.dir && (
            <div className="px-2 pt-2 pb-0.5">
              <span className="text-xxs  text-muted-foreground truncate">{group.dir}</span>
            </div>
          )}
          {group.files.map((f) => (
            <FileRow
              key={f.path}
              file={f}
              onSelect={onSelect}
              isSelected={selectedPath === f.path}
              action={action}
              onAction={onAction}
              actionLoading={actionLoadingPath === f.path}
              onRevert={onRevert}
              revertLoading={revertLoadingPath === f.path}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

type SectionProps = {
  title: string;
  count: number;
  defaultOpen?: boolean;
  headerAction?: React.ReactNode;
  children: React.ReactNode;
};

function Section({ title, count, defaultOpen = true, headerAction, children }: SectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="pb-2">
      <div
        className="flex items-center gap-1.5 px-3 py-1.5 cursor-pointer select-none hover:bg-foreground/5"
        onClick={() => setOpen(!open)}
      >
        {open ? (
          <IconChevronDown className="size-3 text-muted-foreground shrink-0" />
        ) : (
          <IconChevronRight className="size-3 text-muted-foreground shrink-0" />
        )}
        <span className="text-xxs  font-semibold  text-muted-foreground">{title}</span>
        <span className="text-xxs  text-muted-foreground">({count})</span>
        <div className="flex-1" />
        {headerAction && (
          <div onClick={(e) => e.stopPropagation()}>{headerAction}</div>
        )}
      </div>
      {open && children}
    </div>
  );
}

type CommitStep = "changes" | "push";

export const GitChangesPanel = ({ className, onFileSelect: _onFileSelect }: GitChangesPanelProps) => {
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const activeWorkspace = useWorkspaceStore((s) =>
    s.workspaces.find((w) => w.id === s.activeWorkspaceId) ?? null
  );
  const gitChangeVersion = useWorkspaceStore((s) =>
    activeWorkspaceId ? (s.gitChangeVersions[activeWorkspaceId] ?? 0) : 0
  );
  const openDiffViewer = useUIStore((s) => s.openDiffViewer);

  const [staged, setStaged] = useState<GitStagedChange[]>([]);
  const [unstaged, setUnstaged] = useState<GitUnstagedChange[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [stageLoading, setStageLoading] = useState<string | null>(null);
  const [unstageLoading, setUnstageLoading] = useState<string | null>(null);
  const [stageAllLoading, setStageAllLoading] = useState(false);
  const [revertLoading, setRevertLoading] = useState<string | null>(null);
  const [commitMessage, setCommitMessage] = useState("");
  const [commitLoading, setCommitLoading] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);
  const [step, setStep] = useState<CommitStep>("changes");
  const [commitError, setCommitError] = useState<string | null>(null);
  const [aheadCount, setAheadCount] = useState(0);
  const hasLoadedOnceRef = useRef(false);

  const totalCount = staged.length + unstaged.length;
  const totalAdded = useMemo(() => [...staged, ...unstaged].reduce((s, c) => s + c.added, 0), [staged, unstaged]);
  const totalDeleted = useMemo(() => [...staged, ...unstaged].reduce((s, c) => s + c.deleted, 0), [staged, unstaged]);
  const totalStagedAdded = useMemo(() => staged.reduce((s, c) => s + c.added, 0), [staged]);
  const totalStagedDeleted = useMemo(() => staged.reduce((s, c) => s + c.deleted, 0), [staged]);

  const load = useCallback(async () => {
    if (!activeWorkspace?.id) {
      setStaged([]);
      setUnstaged([]);
      setAheadCount(0);
      return;
    }
    const api = getElectronAPI();
    if (!api) return;
    const isInitial = !hasLoadedOnceRef.current;
    if (isInitial) setLoading(true);
    else setRefreshing(true);
    setError(null);
    try {
      const timeoutMs = 8000;
      const [unstagedRes, stagedRes, aheadRes] = await Promise.all([
        Promise.race([
          api.workspace.getUnstagedChanges(activeWorkspace.id),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Request timed out")), timeoutMs)),
        ]),
        Promise.race([
          api.workspace.getStagedChanges(activeWorkspace.id),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Request timed out")), timeoutMs)),
        ]),
        (api.workspace as ElectronAPI["workspace"]).getAheadCount(activeWorkspace.id),
      ]);
      if (unstagedRes.success && unstagedRes.data) setUnstaged(unstagedRes.data);
      else setUnstaged([]);
      if (stagedRes.success && stagedRes.data) setStaged(stagedRes.data);
      else setStaged([]);
      if (aheadRes.success && typeof aheadRes.data === "number") setAheadCount(aheadRes.data);
      else setAheadCount(0);
      hasLoadedOnceRef.current = true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load changes");
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

  const handleStage = useCallback(async (path: string) => {
    const api = getElectronAPI();
    const stage = (api?.workspace as { stageFile?: (w: string, p: string) => Promise<{ success?: boolean }> } | undefined)?.stageFile;
    if (!stage || !activeWorkspace?.id) return;
    setStageLoading(path);
    const result = await stage(activeWorkspace.id, path);
    setStageLoading(null);
    if (result?.success) load();
  }, [activeWorkspace?.id, load]);

  const handleUnstage = useCallback(async (path: string) => {
    const api = getElectronAPI();
    const unstage = (api?.workspace as { unstageFile?: (w: string, p: string) => Promise<{ success?: boolean }> } | undefined)?.unstageFile;
    if (!unstage || !activeWorkspace?.id) return;
    setUnstageLoading(path);
    const result = await unstage(activeWorkspace.id, path);
    setUnstageLoading(null);
    if (result?.success) load();
  }, [activeWorkspace?.id, load]);

  const handleStageAll = useCallback(async () => {
    const api = getElectronAPI();
    const stage = (api?.workspace as { stageFile?: (w: string, p: string) => Promise<{ success?: boolean }> } | undefined)?.stageFile;
    if (!stage || !activeWorkspace?.id || unstaged.length === 0) return;
    setStageAllLoading(true);
    for (const c of unstaged) {
      await stage(activeWorkspace.id, c.path);
    }
    setStageAllLoading(false);
    load();
  }, [activeWorkspace?.id, unstaged, load]);

  const handleRevert = useCallback(async (path: string) => {
    const api = getElectronAPI();
    const revert = (api?.workspace as { revertFileChange?: (w: string, p: string) => Promise<IpcResult> } | undefined)?.revertFileChange;
    if (!revert || !activeWorkspace?.id) return;
    setRevertLoading(path);
    const result = await revert(activeWorkspace.id, path);
    setRevertLoading(null);
    if (result?.success) load();
  }, [activeWorkspace?.id, load]);

  const handleStagedFileSelect = useCallback(
    (path: string) => {
      setSelectedPath(path);
      openDiffViewer(path, true);
    },
    [openDiffViewer]
  );

  const handleUnstagedFileSelect = useCallback(
    (path: string) => {
      setSelectedPath(path);
      openDiffViewer(path, false);
    },
    [openDiffViewer]
  );

  const handleCommit = useCallback(async () => {
    const api = getElectronAPI();
    const commit = (api?.workspace as { commit?: (w: string, m: string) => Promise<{ success?: boolean; error?: string }> })?.commit;
    if (!commit || !activeWorkspace?.id || !commitMessage.trim()) return;
    setCommitLoading(true);
    setCommitError(null);
    const result = await commit(activeWorkspace.id, commitMessage.trim());
    setCommitLoading(false);
    if (result?.success) {
      setStep("push");
      load();
    } else if (result?.error) {
      setCommitError(result.error);
    }
  }, [activeWorkspace?.id, commitMessage, load]);

  const handlePush = useCallback(async () => {
    const api = getElectronAPI();
    const push = (api?.workspace as { push?: (w: string) => Promise<{ success?: boolean; error?: string }> })?.push;
    if (!push || !activeWorkspace?.id) return;
    setPushLoading(true);
    setCommitError(null);
    const result = await push(activeWorkspace.id);
    setPushLoading(false);
    if (result?.success) {
      setStep("changes");
      setCommitMessage("");
      load();
    } else if (result?.error) {
      setCommitError(result.error);
    }
  }, [activeWorkspace?.id, load]);

  const handleDone = useCallback(() => {
    setStep("changes");
    setCommitMessage("");
    setCommitError(null);
  }, []);

  if (!activeWorkspace) {
    return (
      <div className={cn("flex flex-col items-center justify-center py-8 text-xs text-muted-foreground", className)}>
        No workspace selected
      </div>
    );
  }

  if (loading) {
    return (
      <div className={cn("flex flex-col items-center justify-center py-8 text-xs text-muted-foreground", className)}>
        <IconLoader className="size-4 animate-spin mb-2" />
        Loading changes...
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn("flex flex-col gap-2 p-3", className)}>
        <p className="text-xs text-destructive">{error}</p>
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

  return (
    <div className={cn("flex flex-col overflow-hidden pr-1", className)}>
      {step === "changes" && aheadCount > 0 && (
        <div className="shrink-0 flex items-center justify-between gap-2 px-3 py-2 bg-amber-500/10 border-b border-amber-500/20">
          <span className="text-xs font-medium text-amber-700 dark:text-amber-300">
            You have unpushed commits
          </span>
          <Button
            size="xs"
            variant="secondary"
            onClick={handlePush}
            disabled={pushLoading}
            loading={pushLoading}
            className="gap-1 shrink-0"
          >
            <IconUpload className="size-3" />
            Push
          </Button>
        </div>
      )}
      {step === "changes" ? (
        <>
          <div className="shrink-0 p-2 border-b border-foreground/5">
            <div className="flex flex-col gap-1 rounded-lg">
              <Textarea
                placeholder="Commit message..."
                value={commitMessage}
                onChange={(e) => setCommitMessage(e.target.value)}
                className="min-h-[60px] p-3 resize-none text-xs bg-transparent border-0 shadow-none focus-visible:ring-0"
                rows={2}
              />
              {commitError && (
                <p className="text-xxs  text-destructive mt-1">{commitError}</p>
              )}
              <div className="flex items-center justify-between mt-1">
                <span className="text-xxs  text-muted-foreground inline-flex items-center gap-1">
                  {staged.length} staged
                  {(totalStagedAdded > 0 || totalStagedDeleted > 0) && (
                    <>
                      {" · "}
                      <DiffStats added={totalStagedAdded} deleted={totalStagedDeleted} />
                    </>
                  )}
                </span>
                <Button
                  size="xs"
                  onClick={handleCommit}
                  disabled={staged.length === 0 || !commitMessage.trim() || commitLoading}
                  loading={commitLoading}
                  className="gap-1"
                >
                  <IconGitCommit className="size-3" />
                  Commit
                </Button>
              </div>
            </div>
          </div>

          <div className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 border-b border-foreground/5">
            <span className="text-[11px] font-medium text-muted-foreground">
              {totalCount} files
            </span>
            <DiffStats added={totalAdded} deleted={totalDeleted} />
            <div className="flex-1" />
            {refreshing && <IconLoader className="size-3 animate-spin text-muted-foreground" />}
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => load()}
              className="size-5"
              title="Refresh"
            >
              <IconRefresh className="size-3" stroke={1.5} />
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-foreground/5">
            {staged.length > 0 && (
              <Section title="Staged" count={staged.length}>
                <GroupedFileList
                  files={staged}
                  onSelect={handleStagedFileSelect}
                  selectedPath={selectedPath}
                  action="unstage"
                  onAction={handleUnstage}
                  actionLoadingPath={unstageLoading}
                  revertLoadingPath={null}
                />
              </Section>
            )}

            <Section
              title="Unstaged"
              count={unstaged.length}
              headerAction={
                unstaged.length > 0 ? (
                  <Button
                    size="xs"
                    variant="secondary"
                    disabled={stageAllLoading}
                    onClick={handleStageAll}
                    className="text-xxs  h-5"
                  >
                    {stageAllLoading ? "Staging…" : "Stage all"}
                  </Button>
                ) : undefined
              }
            >
              {unstaged.length === 0 ? (
                <p className="px-3 py-3 m-2 text-center border border-dashed border-foreground/5 rounded-md text-xxs  text-muted-foreground">No unstaged changes</p>
              ) : (
                <GroupedFileList
                  files={unstaged}
                  onSelect={handleUnstagedFileSelect}
                  selectedPath={selectedPath}
                  action="stage"
                  onAction={handleStage}
                  actionLoadingPath={stageLoading}
                  onRevert={handleRevert}
                  revertLoadingPath={revertLoading}
                />
              )}
            </Section>
          </div>
        </>
      ) : (
        <div className="flex flex-col gap-3 p-3">
          <div className="flex items-center gap-2 rounded-lg bg-green-500/10 p-2.5">
            <CircleCheckIcon className="size-4 text-green-600 dark:text-green-400" />
            <span className="text-xs font-medium text-green-700 dark:text-green-300">
              Committed successfully
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Push to <span className="font-medium text-foreground">{activeWorkspace.branch || "remote"}</span>?
          </p>
          {commitError && <p className="text-xs text-destructive">{commitError}</p>}
          <div className="flex items-center gap-2">
            <Button size="sm" variant="secondary" onClick={handleDone}>Done</Button>
            <Button size="sm" onClick={handlePush} disabled={pushLoading} loading={pushLoading} className="gap-1">
              <IconUpload className="size-3" />
              Push
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

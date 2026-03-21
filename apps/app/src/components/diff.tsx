import { memo, useCallback, useEffect, useRef, useState } from "react";
import type { IpcResult } from "@agentide/shared";
import { File, PatchDiff } from "@pierre/diffs/react";
import { Button, ChevronDownIcon, CircleXIcon, RotateIcon, cn } from "@agentide/ui";
import { IconLoader } from "@tabler/icons-react";
import { getElectronAPI } from "@/lib/electron";
import { useWorkspaceStore } from "@/store/workspace";
import { DiffStats, FileName, basename } from "@/components/primitives";

const DIFF_OPTIONS = {
  theme: { dark: "agentide-light" as const, light: "agentide-light" as const },
  diffStyle: "unified" as const,
  diffIndicators: "bars" as const,
  disableFileHeader: true,
};

const FILE_OPTIONS = {
  theme: { dark: "agentide-light" as const, light: "agentide-light" as const },
  disableFileHeader: true,
};

function makeSyntheticPatch(name: string, oldContent: string, newContent: string): string {
  const oldLines = oldContent ? oldContent.split("\n") : [];
  const newLines = newContent ? newContent.split("\n") : [];

  const header = [
    `--- a/${name}`,
    `+++ b/${name}`,
    `@@ -${oldLines.length > 0 ? 1 : 0},${oldLines.length} +${newLines.length > 0 ? 1 : 0},${newLines.length} @@`,
  ];

  const body = [
    ...oldLines.map((l) => `-${l}`),
    ...newLines.map((l) => `+${l}`),
  ];

  return [...header, ...body].join("\n");
}

type DiffState = {
  oldContent: string;
  newContent: string;
  patch: string;
  loading: boolean;
  error: string | null;
};

type DiffViewerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filePath: string | null;
  staged?: boolean;
  className?: string;
};

type DiffStackItem = {
  path: string;
  added?: number;
  deleted?: number;
};

type DiffStackViewerProps = {
  open: boolean;
  items: DiffStackItem[];
  staged?: boolean;
  className?: string;
  hideSidebar?: boolean;
  scrollToPathRef?: React.MutableRefObject<((path: string) => void) | null>;
};

export function DiffViewer({ open, onOpenChange, filePath, staged = false, className }: DiffViewerProps) {
  const activeWorkspace = useWorkspaceStore((s) =>
    s.workspaces.find((w) => w.id === s.activeWorkspaceId) ?? null
  );
  const gitChangeVersion = useWorkspaceStore((s) =>
    activeWorkspace?.id ? (s.gitChangeVersions[activeWorkspace.id] ?? 0) : 0
  );

  const [diff, setDiff] = useState<DiffState>({
    oldContent: "",
    newContent: "",
    patch: "",
    loading: false,
    error: null,
  });
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [fileLoading, setFileLoading] = useState(false);
  const [fileError, setFileError] = useState(false);
  const [revertLoading, setRevertLoading] = useState(false);

  const fetchDiff = useCallback(async (path: string, isStaged: boolean) => {
    const api = getElectronAPI();
    if (!api?.workspace?.getFileDiffContent || !activeWorkspace?.id) return;
    setDiff({ oldContent: "", newContent: "", patch: "", loading: true, error: null });
    const result = await api.workspace.getFileDiffContent(activeWorkspace.id, path, isStaged);
    if (result.success && result.data) {
      setDiff({
        oldContent: result.data.oldContent,
        newContent: result.data.newContent,
        patch: result.data.patch ?? "",
        loading: false,
        error: null,
      });
    } else {
      setDiff({
        oldContent: "",
        newContent: "",
        patch: "",
        loading: false,
        error: result.error ?? "Failed to load diff",
      });
    }
  }, [activeWorkspace?.id]);

  const fetchFileContent = useCallback(async (path: string) => {
    const api = getElectronAPI();
    if (!api?.filesystem?.readFile || !activeWorkspace?.path) return;
    setFileLoading(true);
    setFileContent(null);
    setFileError(false);
    const fullPath = `${activeWorkspace.path.replace(/[/\\]+$/, "")}/${path.replace(/^[/\\]+/, "")}`.replace(
      /\\/g,
      "/"
    );
    const result = await api.filesystem.readFile(fullPath);
    setFileLoading(false);
    if (result.success && result.data !== undefined) {
      setFileContent(result.data);
    } else {
      setFileError(true);
    }
  }, [activeWorkspace?.path]);

  useEffect(() => {
    if (!open || !filePath) {
      setDiff({ oldContent: "", newContent: "", patch: "", loading: false, error: null });
      setFileContent(null);
      setFileError(false);
      return;
    }
    fetchDiff(filePath, staged);
  }, [open, filePath, staged, fetchDiff, gitChangeVersion]);

  useEffect(() => {
    if (
      !open ||
      !filePath ||
      diff.loading ||
      diff.error ||
      diff.patch ||
      diff.oldContent !== "" ||
      diff.newContent !== ""
    ) {
      return;
    }
    fetchFileContent(filePath);
  }, [open, filePath, diff.loading, diff.error, diff.oldContent, diff.newContent, fetchFileContent]);

  const handleRevert = useCallback(async () => {
    if (!filePath) return;
    const api = getElectronAPI();
    const revert = (api?.workspace as { revertFileChange?: (w: string, p: string) => Promise<IpcResult> } | undefined)?.revertFileChange;
    if (!revert || !activeWorkspace?.id) return;
    setRevertLoading(true);
    const result = await revert(activeWorkspace.id, filePath);
    setRevertLoading(false);
    if (result?.success) onOpenChange(false);
  }, [filePath, activeWorkspace?.id, onOpenChange]);

  if (!open) return null;

  const name = filePath ? basename(filePath) : "";

  const rootClassName = cn("light-theme-island min-w-0 bg-background text-foreground", className);

  return (
    <div className={rootClassName}>
      <div className="flex h-10 items-center gap-2 border-b border-border px-3">
        <FileName
          path={filePath || ""}
          className="min-w-0 flex-1"
        />
        <Button
          size="xs"
          variant="ghost"
          className="shrink-0"
          disabled={revertLoading}
          onClick={handleRevert}
        >
          <RotateIcon className="size-3" />
          {revertLoading ? "Reverting…" : "Revert"}
        </Button>
        <Button size="icon-xs" variant="ghost" onClick={() => onOpenChange(false)}>
          <CircleXIcon className="size-4" />
        </Button>
      </div>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-auto select-text">
        {diff.loading ? (
          <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
            <IconLoader className="size-4 animate-spin mr-2" />
            Loading diff…
          </div>
        ) : diff.error ? (
          <div className="px-4 py-8 text-sm text-destructive">{diff.error}</div>
        ) : diff.patch ? (
          <PatchDiff patch={diff.patch} options={DIFF_OPTIONS} />
        ) : diff.oldContent === "" && diff.newContent === "" ? (
          fileLoading ? (
            <div className="flex justify-center items-center py-12 text-sm text-muted-foreground">
              <IconLoader className="size-4 animate-spin mr-2" />
              Loading file…
            </div>
          ) : fileContent !== null && !fileError ? (
            <div className="pierre-file-viewer min-h-0 flex-1 overflow-auto bg-background">
              <File
                file={{ name, contents: fileContent }}
                options={FILE_OPTIONS}
              />
            </div>
          ) : (
            <div className="px-4 py-8 text-sm text-muted-foreground">No diff available</div>
          )
        ) : (
          <PatchDiff patch={makeSyntheticPatch(name, diff.oldContent, diff.newContent)} options={DIFF_OPTIONS} />
        )}
      </div>
    </div>
  );
}

function useLazyDiff(path: string, expanded: boolean, workspaceId: string | undefined, staged: boolean, version: number) {
  const [diff, setDiff] = useState<DiffState>({ oldContent: "", newContent: "", patch: "", loading: false, error: null });
  const fetchedVersionRef = useRef<string | null>(null);

  useEffect(() => {
    const key = `${workspaceId}:${path}:${staged}:${version}`;
    if (!expanded || !workspaceId || fetchedVersionRef.current === key) return;

    const api = getElectronAPI();
    if (!api?.workspace?.getFileDiffContent) return;

    fetchedVersionRef.current = key;
    setDiff({ oldContent: "", newContent: "", patch: "", loading: true, error: null });

    let cancelled = false;
    void api.workspace.getFileDiffContent(workspaceId, path, staged).then((result) => {
      if (cancelled) return;
      if (result.success && result.data) {
        setDiff({
          oldContent: result.data.oldContent ?? "",
          newContent: result.data.newContent ?? "",
          patch: result.data.patch ?? "",
          loading: false,
          error: null,
        });
      } else {
        setDiff({ oldContent: "", newContent: "", patch: "", loading: false, error: result.error ?? "Failed to load diff" });
      }
    });

    return () => { cancelled = true; };
  }, [path, expanded, workspaceId, staged, version]);

  return diff;
}

type DiffStackItemRowProps = {
  item: DiffStackItem;
  expanded: boolean;
  workspaceId: string | undefined;
  staged: boolean;
  gitChangeVersion: number;
  onToggle: (path: string) => void;
  refCallback: (node: HTMLDivElement | null) => void;
};

const DiffStackItemRow = memo(function DiffStackItemRow({
  item,
  expanded,
  workspaceId,
  staged,
  gitChangeVersion,
  onToggle,
  refCallback,
}: DiffStackItemRowProps) {
  const diff = useLazyDiff(item.path, expanded, workspaceId, staged, gitChangeVersion);
  const name = basename(item.path);

  return (
    <div ref={refCallback} className="shadow-card rounded-lg bg-base-background">
      <button
        type="button"
        onClick={() => onToggle(item.path)}
        className={`flex w-full items-center cursor-pointer gap-2 px-3 py-3 text-left ${expanded ? "border-b border-border" : ""}`}
      >
        <FileName path={item.path} className="min-w-0 flex-1" />
        <DiffStats added={item.added ?? 0} deleted={item.deleted ?? 0} badge className="shrink-0" />
        <ChevronDownIcon
          className={`size-3 text-muted-foreground transition-transform ${expanded ? "rotate-180" : ""}`}
        />
      </button>
      {expanded && (
        <DiffContent diff={diff} name={name} />
      )}
    </div>
  );
});

const DiffContent = memo(function DiffContent({ diff, name }: { diff: DiffState; name: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); observer.disconnect(); } },
      { rootMargin: "200px 0px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={containerRef} className="min-w-0">
      {!visible || diff.loading ? (
        <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
          <IconLoader className="size-4 animate-spin mr-2" />
          Loading diff…
        </div>
      ) : diff.error ? (
        <div className="px-4 py-8 text-sm text-destructive">{diff.error}</div>
      ) : diff.patch ? (
        <PatchDiff patch={diff.patch} options={DIFF_OPTIONS} />
      ) : diff.oldContent === "" && diff.newContent === "" ? (
        <div className="px-4 py-8 text-sm text-muted-foreground">No diff available</div>
      ) : (
        <PatchDiff patch={makeSyntheticPatch(name, diff.oldContent, diff.newContent)} options={DIFF_OPTIONS} />
      )}
    </div>
  );
});

export function DiffStackViewer({ open, items, staged = false, className, hideSidebar, scrollToPathRef }: DiffStackViewerProps) {
  const activeWorkspace = useWorkspaceStore((s) =>
    s.workspaces.find((w) => w.id === s.activeWorkspaceId) ?? null
  );
  const gitChangeVersion = useWorkspaceStore((s) =>
    activeWorkspace?.id ? (s.gitChangeVersions[activeWorkspace.id] ?? 0) : 0
  );
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(() => new Set());
  const itemRefs = useRef(new Map<string, HTMLDivElement | null>());

  const setItemRef = useCallback(
    (path: string) => (node: HTMLDivElement | null) => {
      if (node) itemRefs.current.set(path, node);
      else itemRefs.current.delete(path);
    },
    []
  );

  const scrollToPath = useCallback((path: string) => {
    setExpandedPaths((prev) => {
      const next = new Set(prev);
      next.add(path);
      return next;
    });
    requestAnimationFrame(() => {
      itemRefs.current.get(path)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, []);

  useEffect(() => {
    if (scrollToPathRef) scrollToPathRef.current = scrollToPath;
  }, [scrollToPath, scrollToPathRef]);

  useEffect(() => {
    if (!open) {
      setExpandedPaths(new Set());
      return;
    }
    setExpandedPaths(items.length <= 5 ? new Set(items.map((i) => i.path)) : new Set(items.slice(0, 1).map((i) => i.path)));
  }, [open, items]);

  const togglePath = useCallback((path: string) => {
    setExpandedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }, []);

  if (!open) return null;

  const rootClassName = cn("light-theme-island min-w-0 bg-background text-foreground", className);

  return (
    <div className={rootClassName}>
      <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden">
        {!hideSidebar && (
          <div className="w-56 shrink-0">
            <div className="flex h-full flex-col gap-1 overflow-auto p-2">
              {items.map((item) => (
                <Button
                  key={item.path}
                  type="button"
                  onClick={() => scrollToPath(item.path)}
                  variant={expandedPaths.has(item.path) ? "secondary" : "ghost"}
                >
                  <FileName path={item.path} className="min-w-0 flex-1 text-xs" />
                  <DiffStats added={item.added ?? 0} deleted={item.deleted ?? 0} badge className="shrink-0" />
                </Button>
              ))}
            </div>
          </div>
        )}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-auto">
          {items.map((item) => (
            <DiffStackItemRow
              key={item.path}
              item={item}
              expanded={expandedPaths.has(item.path)}
              workspaceId={activeWorkspace?.id}
              staged={staged}
              gitChangeVersion={gitChangeVersion}
              onToggle={togglePath}
              refCallback={setItemRef(item.path)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

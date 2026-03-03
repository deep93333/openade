import { useCallback, useEffect, useState } from "react";
import type { IpcResult } from "@agentide/shared";
import { MultiFileDiff } from "@pierre/diffs/react";
import { Button, CircleXIcon, RotateIcon } from "@agentide/ui";
import { IconLoader } from "@tabler/icons-react";
import { getElectronAPI } from "@/lib/electron";
import { useWorkspaceStore } from "@/store/workspace.store";
import { FileName, basename } from "@/components/primitives";

const DIFF_OPTIONS = {
  theme: { dark: "agentide-dark" as const, light: "agentide-dark" as const },
  diffStyle: "unified" as const,
  diffIndicators: "bars" as const,
  disableFileHeader: true,
};

type DiffState = {
  oldContent: string;
  newContent: string;
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

export function DiffViewer({ open, onOpenChange, filePath, staged = false, className }: DiffViewerProps) {
  const activeWorkspace = useWorkspaceStore((s) =>
    s.workspaces.find((w) => w.id === s.activeWorkspaceId) ?? null
  );
  const gitChangeVersion = useWorkspaceStore((s) =>
    activeWorkspace?.id ? (s.gitChangeVersions[activeWorkspace.id] ?? 0) : 0
  );

  const [diff, setDiff] = useState<DiffState>({ oldContent: "", newContent: "", loading: false, error: null });
  const [revertLoading, setRevertLoading] = useState(false);

  const fetchDiff = useCallback(async (path: string, isStaged: boolean) => {
    const api = getElectronAPI();
    if (!api?.workspace?.getFileDiffContent || !activeWorkspace?.id) return;
    setDiff({ oldContent: "", newContent: "", loading: true, error: null });
    const result = await api.workspace.getFileDiffContent(activeWorkspace.id, path, isStaged);
    if (result.success && result.data) {
      setDiff({ oldContent: result.data.oldContent, newContent: result.data.newContent, loading: false, error: null });
    } else {
      setDiff({ oldContent: "", newContent: "", loading: false, error: result.error ?? "Failed to load diff" });
    }
  }, [activeWorkspace?.id]);

  useEffect(() => {
    if (!open || !filePath) {
      setDiff({ oldContent: "", newContent: "", loading: false, error: null });
      return;
    }
    fetchDiff(filePath, staged);
  }, [open, filePath, staged, fetchDiff, gitChangeVersion]);

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

  return (
    <div className={className}>
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
      <div className="flex min-h-0 flex-1 flex-col overflow-auto select-text">
        {diff.loading ? (
          <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
            <IconLoader className="size-4 animate-spin mr-2" />
            Loading diff…
          </div>
        ) : diff.error ? (
          <div className="px-4 py-8 text-sm text-destructive">{diff.error}</div>
        ) : diff.oldContent === "" && diff.newContent === "" ? (
          <div className="px-4 py-8 text-sm text-muted-foreground">No diff available</div>
        ) : (
          <MultiFileDiff
            oldFile={{ name, contents: diff.oldContent }}
            newFile={{ name, contents: diff.newContent }}
            options={DIFF_OPTIONS}
          />
        )}
      </div>
    </div>
  );
}

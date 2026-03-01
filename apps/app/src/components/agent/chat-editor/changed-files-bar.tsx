import { useCallback, useState } from "react";
import { Button, ChevronDownIcon, Popover, PopoverContent, PopoverTrigger, Textarea } from "@agentide/ui";
import { IconGitCommit, IconUpload, IconEye, IconLoader } from "@tabler/icons-react";
import { cn } from "@/lib/cn";
import { FileName, DiffStats } from "@/components/primitives";
import { useUIStore } from "@/store/ui.store";
import { getElectronAPI } from "@/lib/electron";
import { useWorkspaceStore } from "@/store/workspace.store";
import type { ThreadChangedFile } from "./types";

type ChangedFilesSummary = { added: number; deleted: number };

type ChangedFilesBarProps = {
  threadChangedFiles: ThreadChangedFile[];
  summary: ChangedFilesSummary;
  isExpanded: boolean;
  onToggleExpanded: () => void;
  onFileSelect?: (path: string) => void;
  isRunning: boolean;
};

export const ChangedFilesBar = ({
  threadChangedFiles,
  summary,
  isExpanded,
  onToggleExpanded,
  onFileSelect,
  isRunning,
}: ChangedFilesBarProps) => {
  const setRightPanelOpen = useUIStore((s) => s.setRightPanelOpen);
  const activeWorkspace = useWorkspaceStore((s) => s.activeWorkspace);
  const [committing, setCommitting] = useState(false);
  const [commitPopoverOpen, setCommitPopoverOpen] = useState(false);
  const [commitMessage, setCommitMessage] = useState("");

  const handleReview = () => {
    setRightPanelOpen(true);
  };

  const [commitError, setCommitError] = useState<string | null>(null);

  const handleCommit = useCallback(async () => {
    if (!activeWorkspace?.id || committing || !commitMessage.trim()) return;
    
    const api = getElectronAPI();
    if (!api?.workspace) {
      setCommitError("API not available");
      return;
    }

    setCommitting(true);
    setCommitError(null);
    try {
      // Stage all files
      for (const file of threadChangedFiles) {
        const result = await api.workspace.stageFile(activeWorkspace.id, file.path);
        if (!result?.success) {
          setCommitError(`Failed to stage: ${file.path}`);
          return;
        }
      }
      // Commit
      const result = await api.workspace.commit(activeWorkspace.id, commitMessage.trim());
      if (result?.success) {
        setCommitMessage("");
        setCommitPopoverOpen(false);
      } else {
        setCommitError(result?.error || "Commit failed");
      }
    } catch (err) {
      setCommitError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setCommitting(false);
    }
  }, [activeWorkspace?.id, threadChangedFiles, committing, commitMessage]);

  return (
    <div className="mx-2 px-2 py-0.5 min-h-9 bg-tertiary/90 dark:bg-background shadow-popover translate-y-[1px]  rounded-t-xl text-xs text-muted-foreground">
      <div className="flex items-center h-8 px-1 gap-1.5 w-full">
        <button
          type="button"
          className="inline-flex cursor-pointer shrink-0 flex-1 items-center gap-1.5 text-xs text-foreground/70 hover:text-foreground transition-colors"
          onClick={onToggleExpanded}
          disabled={isRunning}
        >
          <span className="truncate">Changed files ({threadChangedFiles.length})</span>
          <DiffStats added={summary.added} deleted={summary.deleted} badge />
          <div className="flex-1" />
          {threadChangedFiles.length > 0 && (
          <div onKeyDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()} className="flex items-center gap-0.5 shrink-0">
            <Popover open={commitPopoverOpen} onOpenChange={setCommitPopoverOpen}>
              <PopoverTrigger asChild>
                <Button
                  size="xs"
                  variant="bordered"
                  disabled={isRunning || committing}
                  title="Commit all changes"
                >
                  {committing ? "Committing..." : "Commit"}
                </Button>
              </PopoverTrigger>
              <PopoverContent sideOffset={16} className="w-84 p-2" align="end">
                <div className="flex flex-col items-start gap-2">
                  {commitError && (
                    <p className="text-xs text-destructive bg-destructive/10 p-2 rounded w-full">{commitError}</p>
                  )}
                  <p className="text-xs font-medium">Commit message</p>
                  <Textarea
                    value={commitMessage}
                    onChange={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      
                      setCommitMessage(e.target.value);
                    
                    }}
                    placeholder="Enter commit message..."
                    className="min-h-[80px] text-xs"
                    onKeyDown={(e) => {
                      e.stopPropagation();
                      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                        handleCommit();
                      }
                    }}
                  />
                  <div className="flex justify-end w-full gap-2">
                    <Button
                      size="xs"
                      variant="ghost"
                      onClick={() => {
                        setCommitPopoverOpen(false);
                        setCommitMessage("");
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      size="xs"
                      onClick={handleCommit}
                      disabled={!commitMessage.trim() || committing}
                      loading={committing}
                    >
                      Commit
                    </Button>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
           
          </div>
        )}
          <ChevronDownIcon
            className={cn("size-3.5 shrink-0 opacity-60 transition-transform", isExpanded && "rotate-180")}
          />
        </button>
       
      </div>
      {threadChangedFiles.length > 0 && isExpanded && (
        <div className="max-h-[180px] mt-1 mb-2 overflow-y-auto bg-background/10 dark:bg-foreground/5 backdrop-blur-xl rounded-lg p-1 ring-1 ring-foreground/10">
          {threadChangedFiles.map((file) => (
            <button
              key={file.path}
              type="button"
              onClick={() => onFileSelect?.(file.path)}
              className="flex w-full items-center gap-2 rounded px-2 py-2 text-left hover:bg-foreground/5"
            >
              <FileName path={file.path} nameClassName="text-xs text-foreground/80" className="min-w-0 flex-1" />
              <DiffStats added={file.added} deleted={file.deleted} badge className="shrink-0" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

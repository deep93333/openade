import { ChevronDownIcon, Switch } from "@agentide/ui";
import { IconRepeat } from "@tabler/icons-react";
import { cn } from "@/lib/cn";
import { useAgentStore } from "@/store/agent.store";
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
  const requireApproval = useAgentStore((s) => s.requireApproval);
  const setRequireApproval = useAgentStore((s) => s.setRequireApproval);
  return (
    <div className="mx-2 px-3 py-0.5 min-h-9 bg-tertiary/90 dark:bg-background backdrop-blur-xl ring-1 ring-foreground/10 rounded-t-xl text-xs text-muted-foreground">
      <div className="flex items-center gap-1.5 w-full">
        <button
          type="button"
          className="inline-flex cursor-pointer shrink-0 flex-1 items-center gap-1.5 text-xs text-foreground/70 hover:text-foreground transition-colors"
          onClick={onToggleExpanded}
          disabled={isRunning}
        >
          <span className="truncate">Changed files ({threadChangedFiles.length})</span>
          {(summary.added > 0 || summary.deleted > 0) && (
            <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
              {summary.added > 0 && (
                <span className="rounded bg-green-500/15 px-1 text-green-700 dark:text-green-400">
                  +{summary.added}
                </span>
              )}
              {summary.deleted > 0 && (
                <span className="rounded bg-red-500/15 px-1 text-red-700 dark:text-red-400">
                  -{summary.deleted}
                </span>
              )}
            </span>
          )}
          <div className="flex-1" />
          <ChevronDownIcon
            className={cn("size-3.5 shrink-0 opacity-60 transition-transform", isExpanded && "rotate-180")}
          />
        </button>
        <label className="flex cursor-pointer items-center gap-1.5 py-1.5">
          <IconRepeat stroke={1.75} className="size-3.5 text-foreground/50" />
          <span className="text-xs text-foreground/50">Auto mode</span>
          <Switch
            checked={!requireApproval}
            onCheckedChange={(checked) => setRequireApproval(checked !== true)}
            disabled={isRunning}
          />
        </label>
      </div>
      {threadChangedFiles.length > 0 && isExpanded && (
        <div className="max-h-[180px] my-1 overflow-y-auto bg-background/50 dark:bg-foreground/5 backdrop-blur-xl rounded-lg p-1 ring-1 ring-foreground/10">
          {threadChangedFiles.map((file) => (
            <button
              key={file.path}
              type="button"
              onClick={() => onFileSelect?.(file.path)}
              className="flex w-full items-center gap-2 rounded px-2 py-2 text-left hover:bg-foreground/5"
            >
              <span className="min-w-0 flex-1 truncate text-xs text-foreground/80">{file.path}</span>
              <div className="flex shrink-0 items-center gap-1">
                {file.added > 0 && (
                  <span className="rounded bg-green-500/15 px-1.5 py-0.5 text-[10px] font-medium text-green-700 dark:text-green-400">
                    +{file.added}
                  </span>
                )}
                {file.deleted > 0 && (
                  <span className="rounded bg-red-500/15 px-1.5 py-0.5 text-[10px] font-medium text-red-700 dark:text-red-400">
                    -{file.deleted}
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

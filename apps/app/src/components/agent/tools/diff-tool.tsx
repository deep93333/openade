import { PatchDiff, MultiFileDiff } from "@pierre/diffs/react";
import { CodeblockIcon } from "@agentide/ui";
import type { ToolComponentProps } from "./types";

const DIFF_OPTIONS = {
  theme: "pierre-light" as const,
  diffStyle: "unified" as const,
  diffIndicators: "bars" as const,
};

export const DiffTool = ({ toolInput }: ToolComponentProps) => {
  const patch = (toolInput.patch ?? toolInput.diff ?? toolInput.content ?? "") as string;
  const oldContent = (toolInput.old_content ?? toolInput.before ?? "") as string;
  const newContent = (toolInput.new_content ?? toolInput.after ?? "") as string;
  const filename = (toolInput.filename ?? toolInput.path ?? "file") as string;

  const hasPatch = typeof patch === "string" && patch.length > 0;
  const hasFiles = oldContent && newContent;

  return (
    <div className="flex flex-col gap-1.5 rounded-lg bg-background p-2 ring-1 ring-foreground/10">
      <p className="w-full border-b border-foreground/10 pb-2 text-xs font-medium text-muted-foreground">
        <span className="inline-flex items-center gap-2">
          <CodeblockIcon className="size-3.5" />
          Diff
          {filename && <span className="font-mono">{String(filename).split("/").pop()}</span>}
        </span>
      </p>
      <div className="overflow-hidden rounded-md border border-border">
        {hasPatch ? (
          <PatchDiff patch={patch} options={DIFF_OPTIONS} />
        ) : hasFiles ? (
          <MultiFileDiff
            oldFile={{ name: filename, contents: String(oldContent) }}
            newFile={{ name: filename, contents: String(newContent) }}
            options={DIFF_OPTIONS}
          />
        ) : (
          <pre className="p-3 font-mono text-xs text-muted-foreground">No diff content available</pre>
        )}
      </div>
    </div>
  );
};

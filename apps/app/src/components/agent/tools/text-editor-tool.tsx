import { useState } from "react";
import { PatchDiff } from "@pierre/diffs/react";
import { FileText } from "lucide-react";
import { cn } from "@/lib/cn";
import type { ToolComponentProps } from "./types";
import { ToolContainer } from "./tool-container";
import { buildUnifiedPatch } from "@/utils/build-unified-patch";

const commandLabels: Record<string, { label: string; className: string }> = {
  create: { label: "Create", className: "text-success bg-success/10" },
  write: { label: "Write", className: "text-success bg-success/10" },
  str_replace: { label: "Edit", className: "text-accent bg-accent/10" },
  insert: { label: "Insert", className: "text-accent bg-accent/10" },
  view: { label: "View", className: "text-muted-foreground bg-secondary" },
  undo_edit: { label: "Undo", className: "text-muted-foreground bg-secondary" },
};

export const TextEditorTool = ({ toolInput }: ToolComponentProps) => {
  const command = (toolInput.command as string) ?? "";
  const path = (toolInput.path as string) ?? "";
  const oldStr = (toolInput.old_str as string) ?? "";
  const newStr = (toolInput.new_str as string) ?? "";
  const fileText = (toolInput.file_text as string) ?? "";
  const insertLine = toolInput.insert_line as number | undefined;

  const [expanded, setExpanded] = useState(false);
  const filename = path.split("/").pop() ?? path;
  const meta =
    commandLabels[command] ?? {
      label: command,
      className: "text-muted-foreground bg-secondary",
    };

  const hasDiff = command === "str_replace" && oldStr && newStr;
  const hasContent = command === "create" || command === "write" ? fileText : "";

  const patch = hasDiff ? buildUnifiedPatch(path || "file", oldStr, newStr) : null;

  return (
    <ToolContainer
      icon={<FileText className="size-3.5" strokeWidth={1.5} />}
      title={
        <>
          <span
            className={cn(
              "inline-flex h-5 items-center rounded px-1.5 text-[10px] font-bold uppercase tracking-wider",
              meta.className
            )}
          >
            {meta.label}
          </span>
          <span className="font-mono">{filename}</span>
        </>
      }
      toolInput={toolInput}
    >

      {patch && (
        <div className="overflow-hidden rounded-md border border-border mx-2 mb-2">
          <PatchDiff
            patch={patch}
            options={{
              theme: { dark: "agentide-dark", light: "agentide-dark" },
              diffStyle: "unified",
              diffIndicators: "bars",
              disableFileHeader: true,
            }}
          />
        </div>
      )}

      {command === "insert" && newStr && (
        <div className="overflow-hidden rounded-md border border-border bg-success/10 mx-2 mb-2">
          <div className="flex items-center gap-2 border-b border-border px-3 py-1.5 text-[10px] text-muted-foreground">
            Insert at line {insertLine}
          </div>
          <pre className="overflow-x-auto p-3 font-mono text-xs leading-relaxed text-foreground">
            {newStr}
          </pre>
        </div>
      )}

      {hasContent && (
        <div className="overflow-hidden rounded-md border border-border mx-2 mb-2">
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="flex w-full items-center justify-between border-b border-border bg-secondary px-3 py-1.5 text-[10px] text-muted-foreground hover:bg-tertiary"
          >
            <span>{fileText.split("\n").length} lines</span>
            <span>{expanded ? "Collapse" : "Expand"}</span>
          </button>
          {expanded && (
            <pre className="max-h-64 overflow-auto p-3 font-mono text-xs leading-relaxed text-foreground">
              {hasContent}
            </pre>
          )}
        </div>
      )}

      {command === "view" && (
        <div className="rounded-md border border-border bg-secondary px-3 py-2 text-xs text-muted-foreground mx-2 mb-2">
          Viewing file contents
        </div>
      )}
    </ToolContainer>
  );
};

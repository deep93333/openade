import { File, Folder, Search } from "lucide-react";
import { PatchDiff } from "@pierre/diffs/react";
import type { ToolComponentProps } from "./types";
import { ToolContainer } from "./tool-container";
import { buildUnifiedPatch } from "@/utils/build-unified-patch";

const operationMeta: Record<
  string,
  { icon: "file" | "folder" | "search"; label: string }
> = {
  read: { icon: "file", label: "Read" },
  write: { icon: "file", label: "Write" },
  edit: { icon: "file", label: "Edit" },
  multiedit: { icon: "file", label: "Multi-Edit" },
  glob: { icon: "search", label: "Glob" },
  grep: { icon: "search", label: "Search" },
  ls: { icon: "folder", label: "List" },
  listdir: { icon: "folder", label: "List" },
  delete: { icon: "file", label: "Delete" },
};

const iconMap = {
  file: File,
  folder: Folder,
  search: Search,
};

const DIFF_OPTIONS = {
  theme: { dark: "agentide-dark", light: "agentide-dark" },
  diffStyle: "unified" as const,
  diffIndicators: "bars" as const,
  disableFileHeader: true,
};

export const FileTool = ({ message, toolInput }: ToolComponentProps) => {
  const toolName = (message.toolName ?? "").toLowerCase();
  const meta = operationMeta[toolName] ?? {
    icon: "file" as const,
    label: message.toolName ?? toolName,
  };
  const Icon = iconMap[meta.icon];

  const path = (toolInput.path ??
    toolInput.file_path ??
    toolInput.glob_pattern ??
    toolInput.pattern ??
    "") as string;
  const filename = path.split("/").pop() ?? path;
  const oldContent = (toolInput.old_str ?? toolInput.old_string ?? "") as string;
  const newContent = (toolInput.new_str ?? toolInput.new_string ?? "") as string;
  const showDiff = (toolName === "edit" || toolName === "multiedit") && (oldContent.length > 0 || newContent.length > 0);
  const patch = showDiff ? buildUnifiedPatch(path || filename || "file", oldContent, newContent) : "";

  return (
    <ToolContainer
      icon={<Icon className="size-3.5" strokeWidth={1.5} />}
      title={
        <>
          {meta.label}
          <span className="max-w-[400px] truncate font-mono">{filename || path}</span>
        </>
      }
      toolInput={toolInput}
    >
      {showDiff && (
          <PatchDiff patch={patch} options={DIFF_OPTIONS} />
      )}
      {path && path !== filename && (
        <div
          className="rounded-md overflow-hidden text-ellipsis whitespace-nowrap px-3 py-1.5 font-mono text-xs text-muted-foreground mx-2 mb-2 text-left [direction:rtl]"
          title={path}
        >
          <span className="[direction:ltr] [unicode-bidi:plaintext]">
            {path}
          </span>
        </div>
      )}
    </ToolContainer>
  );
};

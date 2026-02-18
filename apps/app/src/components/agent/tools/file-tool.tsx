import { FileIcon, FolderIcon, SearchIcon } from "@agentide/ui";
import type { ToolComponentProps } from "./types";

const operationMeta: Record<string, { icon: "file" | "folder" | "search"; label: string }> = {
  Read: { icon: "file", label: "Read" },
  Write: { icon: "file", label: "Write" },
  Edit: { icon: "file", label: "Edit" },
  MultiEdit: { icon: "file", label: "Multi-Edit" },
  Glob: { icon: "search", label: "Glob" },
  Grep: { icon: "search", label: "Search" },
  LS: { icon: "folder", label: "List" },
};

const iconMap = {
  file: FileIcon,
  folder: FolderIcon,
  search: SearchIcon,
};

export const FileTool = ({ message, toolInput }: ToolComponentProps) => {
  const toolName = message.toolName ?? "";
  const meta = operationMeta[toolName] ?? { icon: "file" as const, label: toolName };
  const Icon = iconMap[meta.icon];

  const path = (toolInput.path ?? toolInput.file_path ?? toolInput.glob_pattern ?? toolInput.pattern ?? "") as string;
  const filename = path.split("/").pop() ?? path;

  return (
    <div className="flex flex-col gap-1.5 rounded-lg bg-background p-2 ring-1 ring-foreground/10">
      <p className="flex w-full items-center gap-2 border-b border-foreground/10 pb-2 text-xs font-medium text-muted-foreground">
        <Icon className="size-3.5" />
        {meta.label}
        <span className="max-w-[400px] truncate font-mono">{filename || path}</span>
      </p>
      {path && path !== filename && (
        <div className="rounded-md bg-secondary px-3 py-1.5 font-mono text-[11px] text-muted-foreground">
          {path}
        </div>
      )}
    </div>
  );
};

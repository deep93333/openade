import { File, Folder, Search } from "lucide-react";
import { MultiFileDiff } from "@pierre/diffs/react";
import type { ToolComponentProps } from "./types";
import { ToolContainer } from "./container";

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
  const newContent = (toolInput.new_str ??
    toolInput.new_string ??
    toolInput.content ??
    "") as string;
  const showDiff = (toolName === "edit" || toolName === "multiedit" || toolName === "write") && (oldContent.length > 0 || newContent.length > 0);

  if (showDiff) {
    return (
      <>
        <div className="overflow-hidden rounded-md border border-border">
          <MultiFileDiff
            oldFile={{ name: filename || path || "file", contents: oldContent }}
            newFile={{ name: filename || path || "file", contents: newContent }}
            options={DIFF_OPTIONS}
          />
        </div>
        {path && path !== filename && (
          <div
            className="rounded-md overflow-hidden text-ellipsis whitespace-nowrap mt-1.5 font-mono text-xs text-muted-foreground text-left [direction:rtl]"
            title={path}
          >
            <span className="[direction:ltr] [unicode-bidi:plaintext]">{path}</span>
          </div>
        )}
      </>
    );
  }

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
      {path && path !== filename && (
        <div
          className="rounded-md overflow-hidden text-ellipsis whitespace-nowrap px-3 py-1.5 font-mono text-xs text-muted-foreground mx-2 mb-2 text-left [direction:rtl]"
          title={path}
        >
          <span className="[direction:ltr] [unicode-bidi:plaintext]">{path}</span>
        </div>
      )}
    </ToolContainer>
  );
};

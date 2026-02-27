import { useState } from "react";
import type { FileTreeNode } from "@agentide/shared";
import {
  Button,
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
  cn,
} from "@agentide/ui";
import { getElectronAPI } from "@/lib/electron";
import { useFileContextStore } from "@/store/file-context.store";
import { useWorkspaceStore } from "@/store/workspace.store";
import { FolderIcon, getFileTypeIcon } from "./file-icons";

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      className="size-2.5 shrink-0 text-foreground/80 transition-transform duration-100"
      viewBox="0 0 12 12"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ transform: open ? "rotate(90deg)" : "rotate(0deg)" }}
    >
      <path
        d="M4 2.5l4 3.5-4 3.5"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

type FileTreeItemProps = {
  node: FileTreeNode;
  depth: number;
  onSelect?: (path: string) => void;
  onFileSelect?: (path: string) => void;
  selectedPath?: string;
};

export const FileTreeItem = ({ node, depth, onSelect, onFileSelect, selectedPath }: FileTreeItemProps) => {
  const [isExpanded, setIsExpanded] = useState(depth < 2);
  const isDirectory = node.type === "directory";
  const hasChildren = isDirectory && node.children && node.children.length > 0;
  const isSelected = selectedPath === node.path;
  const mentionFileInChat = useFileContextStore((s) => s.mentionFileInChat);
  const workspacePath = useWorkspaceStore((s) =>
    s.workspaces.find((workspace) => workspace.id === s.activeWorkspaceId)?.path ?? null
  );
  const canMentionFile =
    Boolean(mentionFileInChat) && (node.type === "file" || node.type === "directory");

  const handleOpenInEditor = () => {
    const electronAPI = getElectronAPI();
    if (!electronAPI?.editor?.openFile) {
      return;
    }
    electronAPI.editor.openFile(node.path).catch((error) => {
      console.error("Failed to open file in external editor", error);
    });
  };

  const handleMentionInChat = () => {
    mentionFileInChat?.({ filePath: node.path, workspacePath });
    handleOpenInEditor();
  };

  const handleClick = () => {
    if (isDirectory) {
      setIsExpanded(!isExpanded);
    }
    onSelect?.(node.path);
    if (node.type === "file") {
      onFileSelect?.(node.path);
    }
  };

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (hasChildren) {
      setIsExpanded(!isExpanded);
    }
  };

  const row = (
    <div
      className={cn(
        "flex items-center py-1 px-2 text-sm cursor-pointer rounded-lg hover:bg-foreground/10 select-none",
        isSelected && "bg-accent/30 text-foreground/90",
        "group"
      )}
      style={{ paddingLeft: `${depth * 16 + 8}px` }}
      onClick={handleClick}
    >
      <div className="flex items-center min-w-0 flex-1">
        {hasChildren ? (
          <Button
            size="icon-xs"
            variant="ghost"
            onClick={handleToggle}
            className="flex items-center justify-center w-4 h-4 mr-1 hover:bg-zinc-200"
          >
            <ChevronIcon open={isExpanded} />
          </Button>
        ) : (
          <div className="w-5" />
        )}

        <div className="flex items-center min-w-0">
          {isDirectory ? (
            <FolderIcon name={node.name} open={isExpanded} />
          ) : (
            getFileTypeIcon(node.name)
          )}
          <span className="truncate text-muted-foreground">{node.name}</span>
        </div>
      </div>
    </div>
  );

  return (
    <div>
      {canMentionFile ? (
        <ContextMenu>
          <ContextMenuTrigger asChild>{row}</ContextMenuTrigger>
          <ContextMenuContent className="w-44">
            <ContextMenuItem
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                handleMentionInChat();
              }}
            >
              Mention in chat
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                handleOpenInEditor();
              }}
            >
              Open in editor
            </ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
      ) : (
        row
      )}

      {isDirectory && hasChildren && isExpanded && (
        <div>
          {node.children?.map((child) => (
            <FileTreeItem
              key={child.path}
              node={child}
              depth={depth + 1}
              onSelect={onSelect}
              onFileSelect={onFileSelect}
              selectedPath={selectedPath}
            />
          ))}
        </div>
      )}
    </div>
  );
};

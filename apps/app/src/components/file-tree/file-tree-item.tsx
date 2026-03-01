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
import { IconLoader2 } from "@tabler/icons-react";
import { getElectronAPI } from "@/lib/electron";
import { useFileContextStore } from "@/store/file-context.store";
import { useWorkspaceStore } from "@/store/workspace.store";
import { useFileTreeStore } from "@/store/file-tree.store";
import { FileName } from "@/components/primitives";

const INDENT_PX = 16;

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

const LINE_COLOR = "border-foreground/12";

type FileTreeItemProps = {
  node: FileTreeNode;
  depth: number;
  onSelect?: (path: string) => void;
  onFileSelect?: (path: string) => void;
  selectedPath?: string;
};

export const FileTreeItem = ({ node, depth, onSelect, onFileSelect, selectedPath }: FileTreeItemProps) => {
  const isDirectory = node.type === "directory";
  const isSelected = selectedPath === node.path;
  const mentionFileInChat = useFileContextStore((s) => s.mentionFileInChat);
  const workspacePath = useWorkspaceStore((s) =>
    s.workspaces.find((workspace) => workspace.id === s.activeWorkspaceId)?.path ?? null
  );
  const canMentionFile =
    Boolean(mentionFileInChat) && (node.type === "file" || node.type === "directory");

  const expandedPaths = useFileTreeStore((s) => s.expandedPaths);
  const loadingPaths = useFileTreeStore((s) => s.loadingPaths);
  const toggleDirectory = useFileTreeStore((s) => s.toggleDirectory);

  const isExpanded = expandedPaths.has(node.path);
  const isLoading = loadingPaths.has(node.path);
  const hasChildren = isDirectory && node.children && node.children.length > 0;
  const showChevron = isDirectory;

  const handleOpenInEditor = () => {
    const electronAPI = getElectronAPI();
    if (!electronAPI?.editor?.openFile) return;
    electronAPI.editor.openFile(node.path).catch((error) => {
      console.error("Failed to open file in external editor", error);
    });
  };

  const handleMentionInChat = () => {
    mentionFileInChat?.({ filePath: node.path, workspacePath });
  };

  const handleClick = () => {
    if (isDirectory) {
      toggleDirectory(node.path);
    }
    onSelect?.(node.path);
    if (node.type === "file") {
      onFileSelect?.(node.path);
    }
  };

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isDirectory) {
      toggleDirectory(node.path);
    }
  };

  const row = (
    <div
      className={cn(
        "flex items-stretch py-0 pr-1 text-sm cursor-pointer hover:bg-foreground/10 select-none min-w-0",
        isSelected && "bg-foreground/10 text-foreground/90",
        "group"
      )}
      onClick={handleClick}
    >
      {depth > 0 && (
        <div className="flex shrink-0" aria-hidden>
          {Array.from({ length: depth }).map((_, i) => (
            <div
              key={i}
              className="shrink-0 relative"
              style={{ width: INDENT_PX }}
            >
              <div
                className={cn("absolute top-0 bottom-0 w-px", "bg-foreground/5")}
                style={{ left: 7 }}
              />
            </div>
          ))}
        </div>
      )}
      <div className="flex items-center min-w-0 flex-1 gap-0.5 py-1">
        {showChevron ? (
          <Button
            size="icon-xs"
            variant="ghost"
            onClick={handleToggle}
          >
            {isLoading ? (
              <IconLoader2 className="size-2.5 animate-spin text-muted-foreground" />
            ) : (
              <ChevronIcon open={isExpanded} />
            )}
          </Button>
        ) : (
          <div className="w-5 shrink-0" />
        )}

        <FileName
          path={node.name}
          type={isDirectory ? "directory" : "file"}
          isOpen={isExpanded}
          nameClassName="text-muted-foreground"
          className="min-w-0 flex-1 overflow-hidden"
        />
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

      {isDirectory && isExpanded && hasChildren && (
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

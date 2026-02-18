import { useState } from "react";
import type { FileTreeNode } from "@agentide/shared";
import { ChevronRightIcon, ChevronDownIcon, FolderIcon, FileIcon, cn } from "@agentide/ui";

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

  return (
    <div>
      <div
        className={cn(
          "flex items-center py-1 px-2 text-sm cursor-pointer hover:bg-zinc-100 select-none",
          isSelected && "bg-blue-100 text-blue-900",
          "group"
        )}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={handleClick}
      >
        <div className="flex items-center min-w-0 flex-1">
          {hasChildren ? (
            <button
              onClick={handleToggle}
              className="flex items-center justify-center w-4 h-4 mr-1 hover:bg-zinc-200 rounded"
            >
              {isExpanded ? (
                <ChevronDownIcon className="w-3 h-3" />
              ) : (
                <ChevronRightIcon className="w-3 h-3" />
              )}
            </button>
          ) : (
            <div className="w-5" />
          )}

          <div className="flex items-center min-w-0">
            {isDirectory ? (
              <FolderIcon className="w-4 h-4 mr-2 text-blue-500 flex-shrink-0" />
            ) : (
              <FileIcon className="w-4 h-4 mr-2 text-zinc-500 flex-shrink-0" />
            )}
            <span className="truncate text-zinc-700">{node.name}</span>
          </div>
        </div>
      </div>

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
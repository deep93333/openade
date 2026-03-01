import { useEffect, useState } from "react";
import { FileTreeItem } from "./file-tree-item";
import { useWorkspaceStore } from "@/store/workspace.store";
import { useFileTreeStore } from "@/store/file-tree.store";

type FileTreeProps = {
  onFileSelect?: (path: string) => void;
  className?: string;
};

export const FileTree = ({ onFileSelect, className }: FileTreeProps) => {
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const activeWorkspace = useWorkspaceStore((s) =>
    s.workspaces.find((w) => w.id === s.activeWorkspaceId) ?? null
  );
  const fileTreeVersion = useWorkspaceStore((s) =>
    activeWorkspaceId ? (s.fileTreeVersions[activeWorkspaceId] ?? 0) : 0
  );

  const tree = useFileTreeStore((s) => s.tree);
  const loading = useFileTreeStore((s) => s.loading);
  const error = useFileTreeStore((s) => s.error);
  const loadRoot = useFileTreeStore((s) => s.loadRoot);
  const refresh = useFileTreeStore((s) => s.refresh);
  const reset = useFileTreeStore((s) => s.reset);

  const [selectedPath, setSelectedPath] = useState<string>("");

  useEffect(() => {
    if (!activeWorkspace?.path) {
      reset();
      return;
    }
    loadRoot(activeWorkspace.path);
  }, [activeWorkspace?.path, fileTreeVersion]);

  if (!activeWorkspace) {
    return (
      <div className={`flex items-center justify-center h-32 text-sm text-muted-foreground ${className || ""}`}>
        No workspace selected
      </div>
    );
  }

  if (loading) {
    return (
      <div className={`flex items-center justify-center h-32 text-sm text-muted-foreground ${className || ""}`}>
        Loading file tree...
      </div>
    );
  }

  if (error) {
    return (
      <div className={`p-4 ${className || ""}`}>
        <div className="text-sm text-red-600 mb-2">{error}</div>
        <button
          onClick={refresh}
          className="text-xs text-blue-600 hover:text-blue-800 underline"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!tree) {
    return (
      <div className={`flex items-center justify-center h-32 text-sm text-muted-foreground ${className || ""}`}>
        No files found
      </div>
    );
  }

  return (
    <div className={`overflow-auto min-w-0 ${className || ""}`}>
      <div className=" min-w-0">
        <FileTreeItem
          node={tree}
          depth={0}
          onSelect={setSelectedPath}
          onFileSelect={onFileSelect}
          selectedPath={selectedPath}
        />
      </div>
    </div>
  );
};

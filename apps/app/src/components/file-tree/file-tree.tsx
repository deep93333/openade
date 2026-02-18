import { useEffect, useState } from "react";
import type { FileTreeNode } from "@agentide/shared";
import { FileTreeItem } from "./file-tree-item";
import { getElectronAPI } from "@/lib/electron";
import { useWorkspaceStore } from "@/store/workspace.store";

interface FileTreeProps {
  onFileSelect?: (path: string) => void;
  className?: string;
}

export const FileTree = ({ onFileSelect, className }: FileTreeProps) => {
  const { activeWorkspace } = useWorkspaceStore();
  const [fileTree, setFileTree] = useState<FileTreeNode | null>(null);
  const [selectedPath, setSelectedPath] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!activeWorkspace?.path) {
      setFileTree(null);
      return;
    }

    loadFileTree(activeWorkspace.path);
  }, [activeWorkspace?.path]);

  const loadFileTree = async (workspacePath: string) => {
    setLoading(true);
    setError(null);

    try {
      const api = getElectronAPI();
      if (!api) {
        setError("Electron API not available");
        return;
      }

      const response = await api.filesystem.readDirectoryTree(workspacePath);

      if (response.success && response.data) {
        setFileTree(response.data);
      } else {
        setError(response.error || "Failed to load file tree");
      }
    } catch (err) {
      console.error("Failed to load file tree:", err);
      setError("Failed to load file tree");
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (path: string) => {
    setSelectedPath(path);
  };

  const refresh = () => {
    if (activeWorkspace?.path) {
      loadFileTree(activeWorkspace.path);
    }
  };

  if (!activeWorkspace) {
    return (
      <div className={`flex items-center justify-center h-32 text-sm text-zinc-500 ${className || ""}`}>
        No workspace selected
      </div>
    );
  }

  if (loading) {
    return (
      <div className={`flex items-center justify-center h-32 text-sm text-zinc-500 ${className || ""}`}>
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

  if (!fileTree) {
    return (
      <div className={`flex items-center justify-center h-32 text-sm text-zinc-500 ${className || ""}`}>
        No files found
      </div>
    );
  }

  return (
    <div className={`overflow-auto ${className || ""}`}>
      <div className="py-2">
        <FileTreeItem
          node={fileTree}
          depth={0}
          onSelect={handleSelect}
          onFileSelect={onFileSelect}
          selectedPath={selectedPath}
        />
      </div>
    </div>
  );
};
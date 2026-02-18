import { useEffect, useState } from "react";
import type { FileTreeNode } from "@agentide/shared";
import { getElectronAPI } from "@/lib/electron";
import { useWorkspaceStore } from "@/store/workspace.store";

function flattenFileTree(node: FileTreeNode): { id: string; label: string }[] {
  if (node.type === "file") {
    return [{ id: node.path, label: node.name }];
  }
  const children = node.children ?? [];
  return children.flatMap(flattenFileTree);
}

export function useWorkspaceFiles(): { id: string; label: string }[] {
  const { activeWorkspace } = useWorkspaceStore();
  const [files, setFiles] = useState<{ id: string; label: string }[]>([]);

  useEffect(() => {
    if (!activeWorkspace?.path) {
      setFiles([]);
      return;
    }
    const api = getElectronAPI();
    if (!api) {
      setFiles([]);
      return;
    }
    api.filesystem.readDirectoryTree(activeWorkspace.path).then((res) => {
      if (res.success && res.data) {
        setFiles(flattenFileTree(res.data));
      } else {
        setFiles([]);
      }
    });
  }, [activeWorkspace?.path]);

  return files;
}

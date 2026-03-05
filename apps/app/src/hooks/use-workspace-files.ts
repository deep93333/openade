import { useEffect, useMemo, useState } from "react";
import type { FileTreeNode } from "@agentide/shared";
import { getElectronAPI } from "@/lib/electron";
import { useWorkspaceStore } from "@/store/workspace";

function flattenBreadthFirst(
  tree: FileTreeNode,
  rootPath: string,
): { id: string; label: string; type: "file" | "directory" }[] {
  const files: { id: string; label: string; type: "file" | "directory" }[] = [];
  const dirs: { id: string; label: string; type: "file" | "directory" }[] = [];
  const queue: FileTreeNode[] = [tree];

  while (queue.length > 0) {
    const node = queue.shift()!;
    const relativePath = node.path.startsWith(rootPath)
      ? node.path.slice(rootPath.length).replace(/^\//, "")
      : node.name;

    if (relativePath) {
      const item = { id: node.path, label: relativePath, type: node.type };
      if (node.type === "file") files.push(item);
      else dirs.push(item);
    }

    if (node.children) {
      queue.push(...node.children);
    }
  }

  return [...files, ...dirs];
}

export function useWorkspaceFiles(): { id: string; label: string; type: "file" | "directory" }[] {
  const activeWorkspace = useWorkspaceStore((s) =>
    s.workspaces.find((w) => w.id === s.activeWorkspaceId) ?? null
  );
  const fileTreeVersion = useWorkspaceStore((s) =>
    activeWorkspace?.id ? (s.fileTreeVersions[activeWorkspace.id] ?? 0) : 0
  );
  const [fullTree, setFullTree] = useState<FileTreeNode | null>(null);

  useEffect(() => {
    if (!activeWorkspace?.path) {
      setFullTree(null);
      return;
    }
    const api = getElectronAPI();
    if (!api) {
      setFullTree(null);
      return;
    }
    api.filesystem.readDirectoryTree(activeWorkspace.path).then((res) => {
      if (res.success && res.data) {
        setFullTree(res.data);
      } else {
        setFullTree(null);
      }
    });
  }, [activeWorkspace?.path, fileTreeVersion]);

  return useMemo(() => {
    if (!fullTree || !activeWorkspace?.path) return [];
    return flattenBreadthFirst(fullTree, activeWorkspace.path);
  }, [fullTree, activeWorkspace?.path]);
}

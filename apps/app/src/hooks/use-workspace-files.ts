import { useEffect, useState } from "react";
import type { FileTreeNode } from "@agentide/shared";
import { getElectronAPI } from "@/lib/electron";
import { useWorkspaceStore } from "@/store/workspace.store";

function flattenFileTree(
  node: FileTreeNode,
  rootPath: string,
): { id: string; label: string; type: "file" | "directory" }[] {
  const result: { id: string; label: string; type: "file" | "directory" }[] = [];

  const relativePath = node.path.startsWith(rootPath)
    ? node.path.slice(rootPath.length).replace(/^\//, "")
    : node.name;

  if (relativePath && node.type === "file") {
    result.push({ id: node.path, label: relativePath, type: "file" });
  } else if (relativePath && node.type === "directory") {
    result.push({ id: node.path, label: relativePath, type: "directory" });
  }

  const children = node.children ?? [];
  result.push(...children.flatMap((child) => flattenFileTree(child, rootPath)));

  return result;
}

export function useWorkspaceFiles(): { id: string; label: string; type: "file" | "directory" }[] {
  const activeWorkspace = useWorkspaceStore((s) =>
    s.workspaces.find((w) => w.id === s.activeWorkspaceId) ?? null
  );
  const [files, setFiles] = useState<{ id: string; label: string; type: "file" | "directory" }[]>([]);

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
        setFiles(flattenFileTree(res.data, activeWorkspace.path));
      } else {
        setFiles([]);
      }
    });
  }, [activeWorkspace?.path]);

  return files;
}

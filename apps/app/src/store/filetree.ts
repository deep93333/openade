import type { FileTreeNode } from "@openade/shared";
import { create } from "zustand";
import { getElectronAPI } from "@/lib/electron";

type FileTreeStoreState = {
  tree: FileTreeNode | null;
  workspacePath: string | null;
  loading: boolean;
  error: string | null;
  expandedPaths: Set<string>;
  loadingPaths: Set<string>;

  loadRoot: (workspacePath: string) => Promise<void>;
  expandDirectory: (dirPath: string) => Promise<void>;
  collapseDirectory: (dirPath: string) => void;
  toggleDirectory: (dirPath: string) => Promise<void>;
  reset: () => void;
  refresh: () => Promise<void>;

  getFlatFiles: () => { id: string; label: string; type: "file" | "directory" }[];
};

function insertChildrenAtPath(
  node: FileTreeNode,
  dirPath: string,
  children: FileTreeNode[],
): FileTreeNode {
  if (node.path === dirPath) {
    return { ...node, children };
  }
  if (!node.children) return node;
  return {
    ...node,
    children: node.children.map((child) =>
      child.type === "directory" ? insertChildrenAtPath(child, dirPath, children) : child,
    ),
  };
}

function flattenBreadthFirst(
  tree: FileTreeNode,
  rootPath: string,
): { id: string; label: string; type: "file" | "directory" }[] {
  const result: { id: string; label: string; type: "file" | "directory" }[] = [];
  const queue: FileTreeNode[] = [tree];

  while (queue.length > 0) {
    const node = queue.shift()!;
    const relativePath = node.path.startsWith(rootPath)
      ? node.path.slice(rootPath.length).replace(/^\//, "")
      : node.name;

    if (relativePath) {
      result.push({ id: node.path, label: relativePath, type: node.type });
    }

    if (node.children) {
      queue.push(...node.children);
    }
  }

  const files = result.filter((r) => r.type === "file");
  const dirs = result.filter((r) => r.type === "directory");
  return [...files, ...dirs];
}

export const useFileTreeStore = create<FileTreeStoreState>()((set, get) => ({
  tree: null,
  workspacePath: null,
  loading: false,
  error: null,
  expandedPaths: new Set<string>(),
  loadingPaths: new Set<string>(),

  loadRoot: async (workspacePath: string) => {
    const api = getElectronAPI();
    if (!api) {
      set({ error: "Electron API not available" });
      return;
    }

    set({ loading: true, error: null, workspacePath });

    try {
      const response = await api.filesystem.readDirectoryTree(workspacePath, 1);
      if (response.success && response.data) {
        set({ tree: response.data, loading: false });
      } else {
        set({ error: response.error || "Failed to load file tree", loading: false });
      }
    } catch {
      set({ error: "Failed to load file tree", loading: false });
    }
  },

  expandDirectory: async (dirPath: string) => {
    const { tree, expandedPaths, loadingPaths } = get();
    if (!tree || loadingPaths.has(dirPath)) return;

    const newExpanded = new Set(expandedPaths);
    newExpanded.add(dirPath);
    set({ expandedPaths: newExpanded });

    const api = getElectronAPI();
    if (!api) return;

    const newLoading = new Set(get().loadingPaths);
    newLoading.add(dirPath);
    set({ loadingPaths: newLoading });

    try {
      const response = await api.filesystem.readDirectoryChildren(dirPath);
      if (response.success && response.data) {
        const currentTree = get().tree;
        if (currentTree) {
          set({ tree: insertChildrenAtPath(currentTree, dirPath, response.data) });
        }
      }
    } catch {
      // silently fail — directory stays expanded but empty
    } finally {
      const updated = new Set(get().loadingPaths);
      updated.delete(dirPath);
      set({ loadingPaths: updated });
    }
  },

  collapseDirectory: (dirPath: string) => {
    const newExpanded = new Set(get().expandedPaths);
    newExpanded.delete(dirPath);
    set({ expandedPaths: newExpanded });
  },

  toggleDirectory: async (dirPath: string) => {
    const { expandedPaths } = get();
    if (expandedPaths.has(dirPath)) {
      get().collapseDirectory(dirPath);
    } else {
      await get().expandDirectory(dirPath);
    }
  },

  reset: () => {
    set({
      tree: null,
      workspacePath: null,
      loading: false,
      error: null,
      expandedPaths: new Set(),
      loadingPaths: new Set(),
    });
  },

  refresh: async () => {
    const { workspacePath } = get();
    if (workspacePath) {
      await get().loadRoot(workspacePath);
      set({ expandedPaths: new Set(), loadingPaths: new Set() });
    }
  },

  getFlatFiles: () => {
    const { tree, workspacePath } = get();
    if (!tree || !workspacePath) return [];
    return flattenBreadthFirst(tree, workspacePath);
  },
}));

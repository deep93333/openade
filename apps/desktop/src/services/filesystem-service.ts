import * as fs from "fs/promises";
import * as path from "path";
import type { FileTreeNode } from "@agentide/shared";

const DIRECTORY_TREE_SKIP = new Set([
  ".git", ".svn", ".hg",
  "node_modules", ".pnp",
  "dist", "build", "out", "release",
  ".next", ".nuxt", ".vite", ".turbo", ".cache",
  "coverage", "__pycache__", ".pytest_cache",
  ".DS_Store", "Thumbs.db",
  ".env.local", ".vercel", ".output",
]);

export async function readDirectoryTree(
  dirPath: string,
  maxDepth = 10,
  currentDepth = 0,
): Promise<FileTreeNode> {
  const name = path.basename(dirPath);
  const node: FileTreeNode = {
    name: name || dirPath,
    path: dirPath,
    type: "directory",
    children: [],
  };

  if (currentDepth >= maxDepth) return node;

  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    const filteredEntries = entries.filter((entry) => {
      if (DIRECTORY_TREE_SKIP.has(entry.name)) return false;
      if (entry.isDirectory() && entry.name.startsWith(".")) return false;
      return true;
    });

    for (const entry of filteredEntries) {
      const entryPath = path.join(dirPath, entry.name);

      if (entry.isDirectory()) {
        try {
          const childNode = await readDirectoryTree(entryPath, maxDepth, currentDepth + 1);
          node.children!.push(childNode);
        } catch {
          // Skip directories we can't read
        }
      } else if (entry.isFile()) {
        node.children!.push({
          name: entry.name,
          path: entryPath,
          type: "file",
        });
      }
    }

    node.children!.sort((a, b) => {
      if (a.type !== b.type) return a.type === "directory" ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  } catch (err) {
    console.error(`Error reading directory ${dirPath}:`, err);
  }

  return node;
}

export async function readDirectoryChildren(dirPath: string): Promise<FileTreeNode[]> {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });

  const filteredEntries = entries.filter((entry) => {
    if (DIRECTORY_TREE_SKIP.has(entry.name)) return false;
    if (entry.isDirectory() && entry.name.startsWith(".")) return false;
    return true;
  });

  const children: FileTreeNode[] = [];
  for (const entry of filteredEntries) {
    const entryPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      children.push({ name: entry.name, path: entryPath, type: "directory", children: [] });
    } else if (entry.isFile()) {
      children.push({ name: entry.name, path: entryPath, type: "file" });
    }
  }

  children.sort((a, b) => {
    if (a.type !== b.type) return a.type === "directory" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  return children;
}

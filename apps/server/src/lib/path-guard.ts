import { existsSync } from "node:fs";
import path from "node:path";
import { workspaceManager } from "../services/workspace-manager.js";

export function assertAllowedFilesystemPath(candidate: string): string {
  const resolved = path.resolve(candidate);
  const workspaces = workspaceManager.list();
  for (const w of workspaces) {
    const root = path.resolve(w.path);
    if (resolved === root || resolved.startsWith(`${root}${path.sep}`)) {
      return resolved;
    }
  }
  throw new Error("Path must be inside a registered workspace");
}

export function assertDirectoryExists(dirPath: string): string {
  const resolved = path.resolve(dirPath);
  if (!existsSync(resolved)) {
    throw new Error(`Directory does not exist: ${resolved}`);
  }
  return resolved;
}

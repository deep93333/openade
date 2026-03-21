import { createHash } from "node:crypto";
import * as os from "node:os";
import * as path from "node:path";

export function resolveAgentideDataDir(): string {
  const raw = process.env.AGENTIDE_DATA_DIR?.trim();
  return raw && raw.length > 0 ? raw : path.join(os.homedir(), ".agentide-server");
}

export function threadsStoredInWorkspace(): boolean {
  const v = process.env.AGENTIDE_THREADS_IN_WORKSPACE?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

export function workspaceStorageKey(workspaceId: string | undefined, workspacePath: string): string {
  const id = workspaceId?.trim();
  if (id) return id;
  return createHash("sha256").update(path.resolve(workspacePath)).digest("hex").slice(0, 24);
}

export function getThreadJsonlPath(
  workspacePath: string,
  workspaceId: string | undefined,
  persistenceId: string,
): string {
  if (threadsStoredInWorkspace()) {
    return path.join(workspacePath, ".agentide", "threads", `${persistenceId}.jsonl`);
  }
  const key = workspaceStorageKey(workspaceId, workspacePath);
  return path.join(resolveAgentideDataDir(), "threads", key, `${persistenceId}.jsonl`);
}

export function getLegacyThreadJsonlPath(workspacePath: string, persistenceId: string): string {
  return path.join(workspacePath, ".agentide", "threads", `${persistenceId}.jsonl`);
}

export function getContextDir(workspacePath: string, workspaceId: string | undefined): string {
  if (threadsStoredInWorkspace()) {
    return path.join(workspacePath, ".agentide", "context");
  }
  const key = workspaceStorageKey(workspaceId, workspacePath);
  return path.join(resolveAgentideDataDir(), "context", key);
}

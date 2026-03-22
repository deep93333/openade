import * as fs from "node:fs/promises";
import * as path from "node:path";
import { getOpenadeDataDir } from "../lib/data-paths.js";

export type FileSnapshot = {
  filePath: string;
  beforeContent: string;
  existed: boolean;
};

type RestoreResult = {
  restored: string[];
  deleted: string[];
  errors: string[];
};

function snapshotsBaseDir(): string {
  return path.join(getOpenadeDataDir(), "snapshots");
}

function getSnapshotDir(workspaceId: string, threadId: string, checkpointId: string): string {
  return path.join(snapshotsBaseDir(), workspaceId, threadId, checkpointId);
}

export async function saveSnapshots(
  workspaceId: string,
  threadId: string,
  checkpointId: string,
  snapshots: FileSnapshot[],
): Promise<string> {
  const dir = getSnapshotDir(workspaceId, threadId, checkpointId);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, "snapshots.json"), JSON.stringify(snapshots, null, 2), "utf-8");
  return dir;
}

export async function loadSnapshots(
  workspaceId: string,
  threadId: string,
  checkpointId: string,
): Promise<FileSnapshot[]> {
  const file = path.join(getSnapshotDir(workspaceId, threadId, checkpointId), "snapshots.json");
  try {
    const raw = await fs.readFile(file, "utf-8");
    return JSON.parse(raw) as FileSnapshot[];
  } catch {
    return [];
  }
}

export async function restoreFromSnapshots(snapshots: FileSnapshot[]): Promise<RestoreResult> {
  const restored: string[] = [];
  const deleted: string[] = [];
  const errors: string[] = [];

  for (const snap of snapshots) {
    try {
      if (snap.existed) {
        await fs.mkdir(path.dirname(snap.filePath), { recursive: true });
        await fs.writeFile(snap.filePath, snap.beforeContent, "utf-8");
        restored.push(snap.filePath);
      } else {
        await fs.rm(snap.filePath, { force: true });
        deleted.push(snap.filePath);
      }
    } catch (err) {
      errors.push(`${snap.filePath}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return { restored, deleted, errors };
}

export async function deleteThreadSnapshots(workspaceId: string, threadId: string): Promise<void> {
  const dir = path.join(snapshotsBaseDir(), workspaceId, threadId);
  await fs.rm(dir, { recursive: true, force: true });
}

export async function deleteCheckpointSnapshots(
  workspaceId: string,
  threadId: string,
  checkpointId: string,
): Promise<void> {
  const dir = getSnapshotDir(workspaceId, threadId, checkpointId);
  await fs.rm(dir, { recursive: true, force: true });
}

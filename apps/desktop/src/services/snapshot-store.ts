import * as fs from "node:fs/promises";
import * as path from "node:path";
import { app } from "electron";

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

function getSnapshotDir(workspaceId: string, threadId: string, checkpointId: string): string {
  const base = app?.isPackaged
    ? path.join(app.getPath("userData"), "snapshots")
    : path.join(process.cwd(), "snapshots");
  return path.join(base, workspaceId, threadId, checkpointId);
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
  const dir = path.join(
    app?.isPackaged
      ? path.join(app.getPath("userData"), "snapshots")
      : path.join(process.cwd(), "snapshots"),
    workspaceId,
    threadId,
  );
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

export async function runGarbageCollection(
  workspaceId: string,
  threadId: string,
  keepCheckpointIds: string[],
): Promise<{ deletedDirs: number; freedBytes: number }> {
  const keepSet = new Set(keepCheckpointIds);
  const dir = path.join(
    app?.isPackaged
      ? path.join(app.getPath("userData"), "snapshots")
      : path.join(process.cwd(), "snapshots"),
    workspaceId,
    threadId,
  );

  let deletedDirs = 0;
  let freedBytes = 0;

  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory() || keepSet.has(entry.name)) continue;
      const entryPath = path.join(dir, entry.name);
      const size = await getDirSize(entryPath).catch(() => 0);
      await fs.rm(entryPath, { recursive: true, force: true });
      deletedDirs++;
      freedBytes += size;
    }
  } catch {
    // no-op if dir doesn't exist
  }

  return { deletedDirs, freedBytes };
}

async function getDirSize(dirPath: string): Promise<number> {
  let total = 0;
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      total += await getDirSize(full);
    } else {
      const stat = await fs.stat(full).catch(() => null);
      if (stat) total += stat.size;
    }
  }
  return total;
}

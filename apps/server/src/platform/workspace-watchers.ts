import { spawn } from "node:child_process";
import { existsSync, watch } from "node:fs";
import path from "node:path";
import { IPC } from "@openade/shared";
import { workspaceManager } from "../services/workspace-manager.js";

const DEBOUNCE_MS = 350;
const GIT_DEBOUNCE_MS = 300;
const GIT_POLL_INTERVAL_MS = 2500;

type WsState = {
  workspacePath: string;
  fileWatcher: ReturnType<typeof watch> | null;
  fileDebounceTimer: ReturnType<typeof setTimeout> | null;
  gitIndexWatcher: ReturnType<typeof watch> | null;
  gitDebounceTimer: ReturnType<typeof setTimeout> | null;
  gitPollTimer: ReturnType<typeof setInterval> | null;
  lastGitStatus: string | null;
};

const watchers = new Map<string, WsState>();
let send: ((channel: string, payload: { workspaceId: string }) => void) | null = null;

function runGitStatus(cwd: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn("git", ["status", "--porcelain"], {
      cwd,
      stdio: ["pipe", "pipe", "pipe"],
      shell: process.platform === "win32",
    });
    let out = "";
    let err = "";
    proc.stdout?.on("data", (d) => (out += d.toString()));
    proc.stderr?.on("data", (d) => (err += d.toString()));
    proc.on("close", (code) => {
      if (code === 0) resolve(out);
      else reject(new Error(err || `git status exited ${code}`));
    });
    proc.on("error", reject);
  });
}

function stopOne(id: string): void {
  const state = watchers.get(id);
  if (!state) return;
  if (state.fileWatcher) {
    try {
      state.fileWatcher.close();
    } catch {
      //
    }
  }
  if (state.fileDebounceTimer) clearTimeout(state.fileDebounceTimer);
  if (state.gitIndexWatcher) {
    try {
      state.gitIndexWatcher.close();
    } catch {
      //
    }
  }
  if (state.gitDebounceTimer) clearTimeout(state.gitDebounceTimer);
  if (state.gitPollTimer) clearInterval(state.gitPollTimer);
  watchers.delete(id);
}

function emitFilesChanged(workspaceId: string): void {
  const state = watchers.get(workspaceId);
  if (!state) return;
  if (state.fileDebounceTimer) clearTimeout(state.fileDebounceTimer);
  state.fileDebounceTimer = setTimeout(() => {
    state.fileDebounceTimer = null;
    send?.(IPC.WORKSPACE_FILES_CHANGED, { workspaceId });
  }, DEBOUNCE_MS);
}

function startFileWatcher(workspaceId: string, workspacePath: string): void {
  const state = watchers.get(workspaceId);
  if (!state || !existsSync(workspacePath)) return;
  try {
    const w = watch(
      workspacePath,
      { recursive: process.platform !== "linux" },
      (_eventType, filename) => {
        if (filename && String(filename).includes(".git")) return;
        emitFilesChanged(workspaceId);
      },
    );
    state.fileWatcher = w;
  } catch {
    //
  }
}

function emitGitChanged(workspaceId: string): void {
  const state = watchers.get(workspaceId);
  if (!state) return;
  if (state.gitDebounceTimer) clearTimeout(state.gitDebounceTimer);
  state.gitDebounceTimer = setTimeout(() => {
    state.gitDebounceTimer = null;
    send?.(IPC.WORKSPACE_GIT_CHANGED, { workspaceId });
  }, GIT_DEBOUNCE_MS);
}

function pollGit(workspaceId: string, workspacePath: string): void {
  const state = watchers.get(workspaceId);
  if (!state) return;
  runGitStatus(workspacePath)
    .then((out) => {
      const s = watchers.get(workspaceId);
      if (!s || s.lastGitStatus === out) return;
      s.lastGitStatus = out;
      send?.(IPC.WORKSPACE_GIT_CHANGED, { workspaceId });
    })
    .catch(() => {});
}

function startGitIndexWatcher(workspaceId: string, workspacePath: string): void {
  const state = watchers.get(workspaceId);
  if (!state) return;
  const gitDir = path.join(workspacePath, ".git");
  if (!existsSync(gitDir)) return;
  try {
    const w = watch(gitDir, { recursive: false }, (_eventType, filename) => {
      if (!filename) return;
      const f = String(filename);
      if (f === "index" || f === "HEAD" || f === "COMMIT_EDITMSG") {
        emitGitChanged(workspaceId);
      }
    });
    state.gitIndexWatcher = w;
  } catch {
    //
  }
}

function startGitPoller(workspaceId: string, workspacePath: string): void {
  const state = watchers.get(workspaceId);
  if (!state || !existsSync(workspacePath)) return;
  state.lastGitStatus = null;
  state.gitPollTimer = setInterval(() => {
    pollGit(workspaceId, workspacePath);
  }, GIT_POLL_INTERVAL_MS);
}

function startWorkspaceWatcher(workspaceId: string, workspacePath: string): void {
  if (watchers.has(workspaceId)) stopOne(workspaceId);
  const state: WsState = {
    workspacePath,
    fileWatcher: null,
    fileDebounceTimer: null,
    gitIndexWatcher: null,
    gitDebounceTimer: null,
    gitPollTimer: null,
    lastGitStatus: null,
  };
  watchers.set(workspaceId, state);
  startFileWatcher(workspaceId, workspacePath);
  startGitIndexWatcher(workspaceId, workspacePath);
  startGitPoller(workspaceId, workspacePath);
}

export function setWorkspaceWatchBroadcast(
  fn: (channel: string, payload: { workspaceId: string }) => void,
): void {
  send = fn;
}

export function syncWorkspaceWatchers(): void {
  if (!send) return;
  const list = workspaceManager.list();
  const ids = new Set(list.map((w) => w.id));

  for (const id of watchers.keys()) {
    if (!ids.has(id)) stopOne(id);
  }

  for (const w of list) {
    const existing = watchers.get(w.id);
    if (!existing) {
      startWorkspaceWatcher(w.id, w.path);
    } else if (existing.workspacePath !== w.path) {
      stopOne(w.id);
      startWorkspaceWatcher(w.id, w.path);
    }
  }
}

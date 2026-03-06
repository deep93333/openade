import { watch } from "node:fs";
import { existsSync } from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { IPC } from "@agentide/shared";

const DEBOUNCE_MS = 350;
const GIT_DEBOUNCE_MS = 300;
const GIT_POLL_INTERVAL_MS = 2500;

type Send = (channel: string, payload: { workspaceId: string }) => void;

type State = {
  workspaceId: string;
  workspacePath: string;
  fileWatcher: ReturnType<typeof watch> | null;
  fileDebounceTimer: ReturnType<typeof setTimeout> | null;
  gitIndexWatcher: ReturnType<typeof watch> | null;
  gitDebounceTimer: ReturnType<typeof setTimeout> | null;
  gitPollTimer: ReturnType<typeof setInterval> | null;
  lastGitStatus: string | null;
};

let state: State | null = null;
let send: Send | null = null;

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

function stopFileWatcher(): void {
  if (state?.fileWatcher) {
    try {
      state.fileWatcher.close();
    } catch {
      // ignore
    }
    state.fileWatcher = null;
  }
  if (state?.fileDebounceTimer) {
    clearTimeout(state.fileDebounceTimer);
    state.fileDebounceTimer = null;
  }
}

function stopGitIndexWatcher(): void {
  if (state?.gitIndexWatcher) {
    try {
      state.gitIndexWatcher.close();
    } catch {
      // ignore
    }
    state.gitIndexWatcher = null;
  }
  if (state?.gitDebounceTimer) {
    clearTimeout(state.gitDebounceTimer);
    state.gitDebounceTimer = null;
  }
}

function stopGitPoller(): void {
  if (state?.gitPollTimer) {
    clearInterval(state.gitPollTimer);
    state.gitPollTimer = null;
  }
  state && (state.lastGitStatus = null);
}

function emitFilesChanged(workspaceId: string): void {
  if (state?.fileDebounceTimer) clearTimeout(state.fileDebounceTimer);
  state!.fileDebounceTimer = setTimeout(() => {
    state!.fileDebounceTimer = null;
    send?.(IPC.WORKSPACE_FILES_CHANGED, { workspaceId });
  }, DEBOUNCE_MS);
}

function startFileWatcher(workspaceId: string, workspacePath: string): void {
  if (!existsSync(workspacePath)) return;
  try {
    const watcher = watch(
      workspacePath,
      { recursive: process.platform !== "linux" },
      (eventType, filename) => {
        if (filename && (filename as string).includes(".git")) return;
        emitFilesChanged(workspaceId);
      }
    );
    state!.fileWatcher = watcher;
  } catch {
    // ignore
  }
}

function emitGitChanged(workspaceId: string): void {
  if (state?.gitDebounceTimer) clearTimeout(state.gitDebounceTimer);
  state!.gitDebounceTimer = setTimeout(() => {
    state!.gitDebounceTimer = null;
    send?.(IPC.WORKSPACE_GIT_CHANGED, { workspaceId });
  }, GIT_DEBOUNCE_MS);
}

function pollGit(workspaceId: string, workspacePath: string): void {
  if (!state) return;
  runGitStatus(workspacePath)
    .then((out) => {
      if (!state || state.lastGitStatus === out) return;
      state.lastGitStatus = out;
      send?.(IPC.WORKSPACE_GIT_CHANGED, { workspaceId });
    })
    .catch(() => {});
}

function startGitIndexWatcher(workspaceId: string, workspacePath: string): void {
  const gitDir = path.join(workspacePath, ".git");
  if (!existsSync(gitDir)) return;
  try {
    const watcher = watch(gitDir, { recursive: false }, (_eventType, filename) => {
      if (!filename) return;
      const f = filename as string;
      // index changes = staging/unstaging; HEAD changes = commits/checkouts
      if (f === "index" || f === "HEAD" || f === "COMMIT_EDITMSG") {
        emitGitChanged(workspaceId);
      }
    });
    state!.gitIndexWatcher = watcher;
  } catch {
    // ignore — git dir may not exist for non-git repos
  }
}

function startGitPoller(workspaceId: string, workspacePath: string): void {
  if (!existsSync(workspacePath)) return;
  state!.lastGitStatus = null;
  state!.gitPollTimer = setInterval(() => {
    pollGit(workspaceId, workspacePath);
  }, GIT_POLL_INTERVAL_MS);
}

export function initWorkspaceEvents(sendFn: Send): void {
  send = sendFn;
}

export function setActiveWorkspace(workspaceId: string, workspacePath: string): void {
  stopFileWatcher();
  stopGitIndexWatcher();
  stopGitPoller();
  state = {
    workspaceId,
    workspacePath,
    fileWatcher: null,
    fileDebounceTimer: null,
    gitIndexWatcher: null,
    gitDebounceTimer: null,
    gitPollTimer: null,
    lastGitStatus: null,
  };
  startFileWatcher(workspaceId, workspacePath);
  startGitIndexWatcher(workspaceId, workspacePath);
  startGitPoller(workspaceId, workspacePath);
}

export function clearActiveWorkspace(): void {
  stopFileWatcher();
  stopGitIndexWatcher();
  stopGitPoller();
  state = null;
}

export function getActiveWorkspaceId(): string | null {
  return state?.workspaceId ?? null;
}

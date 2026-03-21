import * as fs from "node:fs/promises";
import os from "node:os";
import * as path from "node:path";
import { validateMCPServers } from "@agentide/agent";
import type {
  AgentMessage,
  ChatData,
  Checkpoint,
  GlobalSettings,
  MCPServerConfig,
} from "@agentide/shared";
import { IPC } from "@agentide/shared";
import { ulid } from "ulid";
import { getAgentLogPath } from "../lib/data-paths.js";
import { assertAllowedFilesystemPath } from "../lib/path-guard.js";
import * as chatStorage from "../services/chat-storage.js";
import * as configStorage from "../services/config-storage.js";
import { readDirectoryChildren, readDirectoryTree } from "../services/filesystem-service.js";
import { gitService } from "../services/git-service.js";
import { getSkillContent, loadSkillsFromDir } from "../services/skills-service.js";
import {
  type FileSnapshot,
  deleteThreadSnapshots,
  loadSnapshots,
  restoreFromSnapshots,
  saveSnapshots,
} from "../services/snapshot-store.js";
import { workspaceManager } from "../services/workspace-manager.js";
import { syncWorkspaceWatchers } from "./workspace-watchers.js";

type PostRunSnapshot = { untracked: string[]; stashSha: string | null };
const postRunSnapshotPromises = new Map<string, Promise<PostRunSnapshot>>();

export async function invokeIpc(channel: string, args: unknown[]): Promise<unknown> {
  try {
    return await dispatch(channel, args);
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Request failed",
    };
  }
}

async function dispatch(channel: string, args: unknown[]): Promise<unknown> {
  switch (channel) {
    case IPC.APP_READY:
    case IPC.APP_QUIT:
      return { success: true };

    case IPC.CONFIG_GET_ACTIVE_WORKSPACE:
      return { success: true, data: configStorage.getActiveWorkspaceId() };

    case IPC.CONFIG_SET_ACTIVE_WORKSPACE: {
      const workspaceId = args[0] as string | null;
      configStorage.setActiveWorkspaceId(workspaceId);
      return { success: true };
    }

    case IPC.API_KEY_GET:
      return { success: true, data: configStorage.getApiKey() };
    case IPC.API_KEY_SET:
      configStorage.setApiKey(args[0] as string | null);
      return { success: true };
    case IPC.API_KEY_HAS:
      return { success: true, data: configStorage.hasApiKey() };

    case IPC.CODEX_API_KEY_GET:
      return { success: true, data: configStorage.getCodexApiKey() };
    case IPC.CODEX_API_KEY_SET:
      configStorage.setCodexApiKey(args[0] as string | null);
      return { success: true };
    case IPC.CODEX_API_KEY_HAS:
      return { success: true, data: configStorage.hasCodexApiKey() };

    case IPC.MINIMAX_API_KEY_GET:
      return { success: true, data: configStorage.getMinimaxApiKey() };
    case IPC.MINIMAX_API_KEY_SET:
      configStorage.setMinimaxApiKey(args[0] as string | null);
      return { success: true };
    case IPC.MINIMAX_API_KEY_HAS:
      return { success: true, data: configStorage.hasMinimaxApiKey() };

    case IPC.API_KEYS_GET:
      return { success: true, data: configStorage.getApiKeyByProvider(args[0] as never) };
    case IPC.API_KEYS_SET:
      configStorage.setApiKeyByProvider(args[0] as never, args[1] as string | null);
      return { success: true };
    case IPC.API_KEYS_HAS:
      return { success: true, data: configStorage.hasApiKeyByProvider(args[0] as never) };

    case IPC.AUTH_STATUS: {
      const method = configStorage.getAuthMethod();
      const hasKey = configStorage.hasApiKey();
      const cli = await configStorage.checkCliLogin();
      return {
        success: true,
        data: { method, hasApiKey: hasKey, cliLoggedIn: cli.loggedIn, cliEmail: cli.email },
      };
    }

    case IPC.AUTH_SET_METHOD:
      configStorage.setAuthMethod(args[0] as never);
      return { success: true };

    case IPC.AUTH_LOGIN: {
      try {
        const { execFile } = await import("node:child_process");
        const { promisify } = await import("node:util");
        const execFileAsync = promisify(execFile);
        await execFileAsync("claude", ["login"], { timeout: 120_000, env: process.env });
        const cli = await configStorage.checkCliLogin();
        if (cli.loggedIn) {
          configStorage.setAuthMethod("claude_login");
          return { success: true, data: { email: cli.email } };
        }
        return { success: false, error: "Login did not complete" };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : "Login failed" };
      }
    }

    case IPC.SETTINGS_GET:
      return { success: true, data: configStorage.getGlobalSettings() };
    case IPC.SETTINGS_SET:
      configStorage.setGlobalSettings(args[0] as GlobalSettings);
      return { success: true };
    case IPC.SETTINGS_VALIDATE_MCP_SERVERS: {
      const result = await validateMCPServers(args[0] as MCPServerConfig[]);
      return { success: true, data: result };
    }

    case IPC.CHAT_LOAD:
      return { success: true, data: chatStorage.getChat(args[0] as string) };
    case IPC.CHAT_SAVE:
      chatStorage.setChat(args[0] as string, args[1] as ChatData);
      return { success: true };
    case IPC.CHAT_DELETE_THREAD: {
      const workspaceId = args[0] as string;
      const threadId = args[1] as string;
      chatStorage.deleteThread(workspaceId, threadId);
      const workspace = workspaceManager.get(workspaceId);
      if (workspace) {
        await gitService.deleteCheckpointRefs(workspace.path, threadId).catch(() => {});
      }
      await deleteThreadSnapshots(workspaceId, threadId).catch(() => {});
      return { success: true };
    }
    case IPC.CHAT_UPDATE_MESSAGE:
      chatStorage.updateMessage(
        args[0] as string,
        args[1] as string,
        args[2] as string,
        args[3] as Partial<Pick<AgentMessage, "content" | "planContent" | "reviewContent">>
      );
      return { success: true };

    case IPC.WORKSPACE_LIST: {
      const workspaces = workspaceManager.list();
      const refreshed = await Promise.all(
        workspaces.map(async (w) => {
          try {
            return await workspaceManager.refreshGitInfo(w.id);
          } catch {
            return w;
          }
        })
      );
      return { success: true, data: refreshed };
    }

    case IPC.WORKSPACE_CREATE: {
      const params = args[0] as { name: string; path: string };
      const workspace = await workspaceManager.create(params.name, params.path);
      syncWorkspaceWatchers();
      return { success: true, data: workspace };
    }

    case IPC.WORKSPACE_DELETE: {
      const id = args[0] as string;
      if (configStorage.getActiveWorkspaceId() === id) {
        configStorage.setActiveWorkspaceId(null);
      }
      chatStorage.removeChat(id);
      workspaceManager.remove(id);
      syncWorkspaceWatchers();
      return { success: true };
    }

    case IPC.WORKSPACE_SELECT: {
      const id = args[0] as string;
      const workspace = workspaceManager.get(id);
      if (!workspace) return { success: false, error: "Workspace not found" };
      try {
        const refreshed = await workspaceManager.refreshGitInfo(id);
        configStorage.setActiveWorkspaceId(refreshed.id);
        return { success: true, data: refreshed };
      } catch {
        configStorage.setActiveWorkspaceId(workspace.id);
        return { success: true, data: workspace };
      }
    }

    case IPC.WORKSPACE_GIT_REFRESH: {
      const workspace = await workspaceManager.refreshGitInfo(args[0] as string);
      return { success: true, data: workspace };
    }
    case IPC.WORKSPACE_GIT_BRANCHES:
      return { success: true, data: await workspaceManager.getGitBranches(args[0] as string) };
    case IPC.WORKSPACE_GIT_SWITCH_BRANCH: {
      const workspace = await workspaceManager.switchGitBranch(
        args[0] as string,
        args[1] as string
      );
      return { success: true, data: workspace };
    }
    case IPC.WORKSPACE_GIT_CREATE_BRANCH: {
      const workspace = await workspaceManager.createGitBranch(
        args[0] as string,
        args[1] as string
      );
      return { success: true, data: workspace };
    }
    case IPC.WORKSPACE_GIT_INIT: {
      const workspace = await workspaceManager.initializeGitRepository(args[0] as string);
      return { success: true, data: workspace };
    }

    case IPC.WORKSPACE_GIT_UNSTAGED_CHANGES: {
      const workspace = workspaceManager.get(args[0] as string);
      if (!workspace) return { success: false, error: "Workspace not found" };
      const isGit = await gitService.isGitRepository(workspace.path);
      if (!isGit) return { success: true, data: [] };
      const changes = await gitService.getUnstagedNumstat(workspace.path);
      return { success: true, data: changes };
    }

    case IPC.WORKSPACE_GET_FILE_DIFF: {
      const workspace = workspaceManager.get(args[0] as string);
      if (!workspace) return { success: false, error: "Workspace not found" };
      const data = await gitService.getFileDiffContent(
        workspace.path,
        args[1] as string,
        (args[2] as boolean | undefined) ?? false
      );
      return { success: true, data };
    }

    case IPC.WORKSPACE_REVERT_FILE_CHANGE: {
      const workspace = workspaceManager.get(args[0] as string);
      if (!workspace) return { success: false, error: "Workspace not found" };
      await gitService.revertUnstagedFile(workspace.path, args[1] as string);
      return { success: true };
    }

    case IPC.WORKSPACE_GIT_STAGED_CHANGES: {
      const workspace = workspaceManager.get(args[0] as string);
      if (!workspace) return { success: false, error: "Workspace not found" };
      const isGit = await gitService.isGitRepository(workspace.path);
      if (!isGit) return { success: true, data: [] };
      const changes = await gitService.getStagedNumstat(workspace.path);
      return { success: true, data: changes };
    }

    case IPC.WORKSPACE_GIT_STAGE_FILE: {
      const workspace = workspaceManager.get(args[0] as string);
      if (!workspace) return { success: false, error: "Workspace not found" };
      await gitService.stageFile(workspace.path, args[1] as string);
      return { success: true };
    }

    case IPC.WORKSPACE_GIT_UNSTAGE_FILE: {
      const workspace = workspaceManager.get(args[0] as string);
      if (!workspace) return { success: false, error: "Workspace not found" };
      await gitService.unstageFile(workspace.path, args[1] as string);
      return { success: true };
    }

    case IPC.WORKSPACE_GIT_COMMIT: {
      const workspace = workspaceManager.get(args[0] as string);
      if (!workspace) return { success: false, error: "Workspace not found" };
      await gitService.commit(workspace.path, args[1] as string);
      await workspaceManager.refreshGitInfo(workspace.id);
      return { success: true };
    }

    case IPC.WORKSPACE_GIT_PUSH: {
      const workspace = workspaceManager.get(args[0] as string);
      if (!workspace) return { success: false, error: "Workspace not found" };
      await gitService.push(workspace.path);
      await workspaceManager.refreshGitInfo(workspace.id);
      return { success: true };
    }

    case IPC.WORKSPACE_GIT_AHEAD_COUNT: {
      const workspace = workspaceManager.get(args[0] as string);
      if (!workspace) return { success: false, error: "Workspace not found" };
      const count = await gitService.getAheadCount(workspace.path);
      return { success: true, data: count };
    }

    case IPC.DIALOG_SELECT_FOLDER:
      return { success: true, data: null };

    case IPC.READ_DIRECTORY_TREE: {
      const dirPath = assertAllowedFilesystemPath(args[0] as string);
      const tree = await readDirectoryTree(dirPath, (args[1] as number | undefined) ?? 10);
      return { success: true, data: tree };
    }

    case IPC.READ_DIRECTORY_CHILDREN: {
      const dirPath = assertAllowedFilesystemPath(args[0] as string);
      const children = await readDirectoryChildren(dirPath);
      return { success: true, data: children };
    }

    case IPC.READ_FILE: {
      const filePath = assertAllowedFilesystemPath(args[0] as string);
      const stat = await fs.stat(filePath);
      if (!stat.isFile()) return { success: false, error: "Path is not a file" };
      const content = await fs.readFile(filePath, "utf-8");
      return { success: true, data: content };
    }

    case IPC.PROJECT_CREATE_EMPTY: {
      const parentDir = path.resolve(args[0] as string);
      const folderName = (args[1] as string).trim();
      const targetPath = path.join(parentDir, folderName);
      if (targetPath === parentDir || !folderName) {
        return { success: false, error: "Invalid folder name" };
      }
      await fs.mkdir(targetPath, { recursive: true });
      await gitService.init(targetPath);
      return { success: true, data: targetPath };
    }

    case IPC.PROJECT_CLONE: {
      const repoUrl = (args[0] as string).trim();
      const parentDir = path.resolve(args[1] as string);
      if (!repoUrl) return { success: false, error: "Repository URL is required" };
      const baseName = path.basename(repoUrl.replace(/\.git$/i, ""));
      if (!baseName) return { success: false, error: "Invalid repository URL" };
      const targetPath = path.join(parentDir, baseName);
      await gitService.clone(repoUrl, targetPath);
      return { success: true, data: targetPath };
    }

    case IPC.TERMINAL_CREATE:
      return { success: false, error: "Integrated terminal requires the desktop app" };
    case IPC.TERMINAL_WRITE:
    case IPC.TERMINAL_RESIZE:
    case IPC.TERMINAL_DESTROY:
      return { success: false };

    case IPC.SKILLS_LIST: {
      const home = os.homedir();
      const cursorSkills = await loadSkillsFromDir(path.join(home, ".cursor", "skills"));
      const claudeSkills = await loadSkillsFromDir(path.join(home, ".claude", "skills"));
      const byId = new Map<string, import("@agentide/shared").AgentSkillItem>();
      for (const s of [...cursorSkills, ...claudeSkills]) {
        if (!byId.has(s.id)) byId.set(s.id, s);
      }
      return { success: true, data: Array.from(byId.values()) };
    }

    case IPC.SKILLS_GET_CONTENT: {
      const home = os.homedir();
      const dirs = [path.join(home, ".cursor", "skills"), path.join(home, ".claude", "skills")];
      const content = await getSkillContent(args[0] as string, dirs);
      if (!content) return { success: false, error: `Skill "${args[0] as string}" not found` };
      return { success: true, data: content };
    }

    case IPC.CHECKPOINT_CREATE:
      return handleCheckpointCreate(
        args[0] as { workspaceId: string; activeThreadId: string; messageIndex: number }
      );
    case IPC.CHECKPOINT_CAPTURE_POST_RUN:
      return handleCheckpointCapturePostRun(args[0] as { workspaceId: string; threadId: string });
    case IPC.CHECKPOINT_FINALIZE:
      return handleCheckpointFinalize(args[0] as { workspaceId: string; threadId: string });
    case IPC.CHECKPOINT_RESTORE:
      return handleCheckpointRestore(
        args[0] as {
          workspaceId: string;
          stashRef: string | null;
          modifiedFiles?: string[];
          createdFiles?: string[];
        }
      );
    case IPC.CHECKPOINT_SAVE_SNAPSHOTS: {
      const p = args[0] as {
        workspaceId: string;
        threadId: string;
        checkpointId: string;
        snapshots: FileSnapshot[];
      };
      await saveSnapshots(p.workspaceId, p.threadId, p.checkpointId, p.snapshots);
      return { success: true };
    }
    case IPC.CHECKPOINT_RESTORE_SNAPSHOTS: {
      const params = args[0] as { workspaceId: string; threadId: string; checkpointId: string };
      const snapshots = await loadSnapshots(
        params.workspaceId,
        params.threadId,
        params.checkpointId
      );
      if (snapshots.length === 0) {
        return { success: false, error: "No snapshots found for this checkpoint" };
      }
      const result = await restoreFromSnapshots(snapshots);
      return { success: true, data: result };
    }

    case IPC.AGENT_LOG_GET_PATH:
      return { success: true, data: getAgentLogPath() };
    case IPC.AGENT_LOG_READ: {
      const logPath = getAgentLogPath();
      const content = await fs.readFile(logPath, "utf-8").catch(() => "");
      return { success: true, data: content };
    }
    case IPC.AGENT_LOG_OPEN_FOLDER:
      return { success: true };

    case IPC.EDITOR_OPEN_FILE:
      return { success: false, error: "Open in external editor is not available in the browser" };

    default:
      return { success: false, error: `Unknown channel: ${channel}` };
  }
}

async function handleCheckpointCreate(params: {
  workspaceId: string;
  activeThreadId: string;
  messageIndex: number;
}) {
  const workspace = workspaceManager.get(params.workspaceId);
  if (!workspace) return { success: false, error: "Workspace not found" };

  const checkpointId = ulid();

  const [stashSha, baseHead, untrackedAtCheckpoint] = await Promise.all([
    gitService.stashCreate(workspace.path).catch(() => null as string | null),
    gitService.getCurrentHead(workspace.path).catch(() => null as string | null),
    gitService.getUntrackedFiles(workspace.path).catch(() => [] as string[]),
  ]);

  let gitStashRef: string | undefined;
  if (stashSha) {
    const refName = `refs/checkpoints/${params.activeThreadId}/${checkpointId}`;
    const created = await gitService
      .createRef(workspace.path, refName, stashSha)
      .then(() => true)
      .catch(() => false);
    gitStashRef = created ? refName : stashSha;
  }

  const chat = chatStorage.getChat(params.workspaceId);
  const thread = chat.threads.find((t) => t.id === params.activeThreadId);
  const prevCheckpoint = thread?.checkpoints?.slice(-1)[0] ?? null;

  let finalizedPrev: Checkpoint | null = null;
  if (prevCheckpoint && !prevCheckpoint.modifiedFiles) {
    const modified = await gitService
      .getModifiedFilesBetween(
        workspace.path,
        prevCheckpoint.gitStashRef ?? null,
        gitStashRef ?? null
      )
      .catch(() => [] as string[]);
    const fromSet = new Set(prevCheckpoint.untrackedAtCheckpoint ?? []);
    const created = untrackedAtCheckpoint.filter((f) => !fromSet.has(f));
    finalizedPrev = { ...prevCheckpoint, modifiedFiles: modified, createdFiles: created };
  }

  const newCheckpoint: Checkpoint = {
    id: checkpointId,
    threadId: params.activeThreadId,
    messageIndex: params.messageIndex,
    timestamp: Date.now(),
    ...(baseHead && { baseHead }),
    untrackedAtCheckpoint,
    ...(gitStashRef && { gitStashRef }),
  };

  const threads = chat.threads.map((t) => {
    if (t.id !== params.activeThreadId) return t;
    const updatedCheckpoints = (t.checkpoints ?? []).map((c) =>
      finalizedPrev && c.id === finalizedPrev.id ? finalizedPrev : c
    );
    return { ...t, checkpoints: [...updatedCheckpoints, newCheckpoint] };
  });
  chatStorage.setChat(params.workspaceId, { threads });
  return { success: true, data: { checkpoint: newCheckpoint, finalizedPrev } };
}

async function handleCheckpointCapturePostRun(params: { workspaceId: string; threadId: string }) {
  const workspace = workspaceManager.get(params.workspaceId);
  if (!workspace) return { success: false, error: "Workspace not found" };
  const key = `${params.workspaceId}:${params.threadId}`;
  postRunSnapshotPromises.set(
    key,
    Promise.all([
      gitService.getUntrackedFiles(workspace.path).catch(() => [] as string[]),
      gitService.stashCreate(workspace.path).catch(() => null as string | null),
    ]).then(([untracked, stashSha]) => ({ untracked, stashSha }))
  );
  return { success: true };
}

async function handleCheckpointFinalize(params: { workspaceId: string; threadId: string }) {
  const workspace = workspaceManager.get(params.workspaceId);
  if (!workspace) return { success: false, error: "Workspace not found" };

  const chat = chatStorage.getChat(params.workspaceId);
  const thread = chat.threads.find((t) => t.id === params.threadId);
  if (!thread) return { success: false, error: "Thread not found" };

  const checkpoint = thread.checkpoints
    ?.slice()
    .reverse()
    .find((c) => !c.modifiedFiles);
  if (!checkpoint) return { success: true, data: null };

  const snapshotKey = `${params.workspaceId}:${params.threadId}`;
  const postRun = (await postRunSnapshotPromises.get(snapshotKey)?.catch(() => null)) ?? null;
  postRunSnapshotPromises.delete(snapshotKey);

  const postRunUntracked =
    postRun?.untracked ??
    (await gitService.getUntrackedFiles(workspace.path).catch(() => [] as string[]));
  const postRunStashSha = postRun?.stashSha ?? null;

  const modified = await gitService
    .getModifiedFilesBetween(workspace.path, checkpoint.gitStashRef ?? null, postRunStashSha)
    .catch(() => [] as string[]);

  const fromUntracked = new Set(checkpoint.untrackedAtCheckpoint ?? []);
  const created = postRunUntracked.filter((f) => !fromUntracked.has(f));

  const updatedThreads = chat.threads.map((t) =>
    t.id === params.threadId
      ? {
          ...t,
          checkpoints: (t.checkpoints ?? []).map((c) =>
            c.id === checkpoint.id ? { ...c, modifiedFiles: modified, createdFiles: created } : c
          ),
        }
      : t
  );
  chatStorage.setChat(params.workspaceId, { threads: updatedThreads });

  return {
    success: true,
    data: { checkpointId: checkpoint.id, modifiedFiles: modified, createdFiles: created },
  };
}

async function handleCheckpointRestore(params: {
  workspaceId: string;
  stashRef: string | null;
  modifiedFiles?: string[];
  createdFiles?: string[];
}) {
  const workspace = workspaceManager.get(params.workspaceId);
  if (!workspace) return { success: false, error: "Workspace not found" };

  if (params.modifiedFiles && params.modifiedFiles.length > 0) {
    await gitService.restoreFiles(workspace.path, params.stashRef, params.modifiedFiles);
    if (params.createdFiles?.length) {
      await gitService.safeDeleteFiles(workspace.path, params.createdFiles);
    }
  } else if (params.stashRef) {
    await gitService.stashApply(workspace.path, params.stashRef);
  } else {
    await gitService.restoreToHead(workspace.path);
  }
  return { success: true };
}

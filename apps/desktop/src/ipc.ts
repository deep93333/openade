import { dialog, ipcMain, shell } from "electron";
import { spawn } from "child_process";
import { IPC } from "@agentide/shared";
import type {
  AgentSkillItem,
  AgentStartParams,
  Checkpoint,
  FileTreeNode,
  ToolApprovalResponse,
} from "@agentide/shared";
import { ulid } from "ulid";
import { agentManager } from "./services/agent-manager";
import { getAgentLogPath, getAgentLogDir } from "./services/agent-log";
import { getAllModels } from "./services/agent-manager";
import * as chatStorage from "./services/chat-storage";
import * as configStorage from "./services/config-storage";
import { workspaceManager } from "./services/workspace-manager";
import { gitService } from "./services/git-service";
import {
  initWorkspaceEvents,
  setActiveWorkspace,
  clearActiveWorkspace,
  getActiveWorkspaceId,
} from "./services/workspace-events";
import * as terminalService from "./services/terminal-service";
import { getAppWindow } from "./windows/app-window";
import * as path from "path";
import * as fs from "fs/promises";
import * as os from "os";

const pendingToolApprovals = new Map<
  string,
  { resolve: (r: { behavior: "allow" | "deny"; updatedInput?: unknown; message?: string }) => void; input: unknown }
>();

type PostRunSnapshot = { untracked: string[]; stashSha: string | null };
const postRunSnapshotPromises = new Map<string, Promise<PostRunSnapshot>>();

const DIRECTORY_TREE_SKIP = new Set([
  '.git', '.svn', '.hg',
  'node_modules', '.pnp',
  'dist', 'build', 'out', 'release',
  '.next', '.nuxt', '.vite', '.turbo', '.cache',
  'coverage', '__pycache__', '.pytest_cache',
  '.DS_Store', 'Thumbs.db',
  '.env.local', '.vercel', '.output',
]);

const readDirectoryTree = async (dirPath: string, maxDepth = 10, currentDepth = 0): Promise<FileTreeNode> => {
  const name = path.basename(dirPath);
  const node: FileTreeNode = {
    name: name || dirPath,
    path: dirPath,
    type: "directory",
    children: [],
  };

  if (currentDepth >= maxDepth) {
    return node;
  }

  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    const filteredEntries = entries.filter(entry => {
      if (DIRECTORY_TREE_SKIP.has(entry.name)) return false;
      if (entry.isDirectory() && entry.name.startsWith('.')) return false;
      return true;
    });

    for (const entry of filteredEntries) {
      const entryPath = path.join(dirPath, entry.name);

      if (entry.isDirectory()) {
        try {
          const childNode = await readDirectoryTree(entryPath, maxDepth, currentDepth + 1);
          node.children!.push(childNode);
        } catch (err) {
          // Skip directories we can't read
          console.warn(`Skipping directory ${entryPath}:`, err);
        }
      } else if (entry.isFile()) {
        node.children!.push({
          name: entry.name,
          path: entryPath,
          type: "file",
        });
      }
    }

    // Sort children: directories first, then files, both alphabetically
    node.children!.sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === "directory" ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });

  } catch (err) {
    console.error(`Error reading directory ${dirPath}:`, err);
  }

  return node;
};

const SKILL_MD = "SKILL.md";
const frontmatterRe = /^---\s*\n([\s\S]*?)\n---/;

async function loadSkillsFromDir(skillsDir: string): Promise<AgentSkillItem[]> {
  const result: AgentSkillItem[] = [];
  try {
    const entries = await fs.readdir(skillsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const skillPath = path.join(skillsDir, entry.name);
      const skillMdPath = path.join(skillPath, SKILL_MD);
      try {
        const stat = await fs.stat(skillMdPath);
        if (!stat.isFile()) continue;
      } catch {
        continue;
      }
      const content = await fs.readFile(skillMdPath, "utf-8");
      const match = content.match(frontmatterRe);
      const name =
        match?.[1]?.match(/name:\s*(.+)/)?.[1]?.trim() ?? entry.name;
      const description =
        match?.[1]?.match(/description:\s*(.+)/)?.[1]?.trim() ?? "";
      result.push({
        id: entry.name,
        name,
        description,
        skillPath: skillMdPath,
      });
    }
  } catch {
    // directory may not exist
  }
  return result;
}

type EditorLauncher = {
  command: string;
  args: (filePath: string, line?: number) => string[];
};

const editorLaunchers: EditorLauncher[] = [
  {
    command: "cursor",
    args: (filePath, line) => (line ? [`${filePath}:${line}`] : [filePath]),
  },
  {
    command: "code",
    args: (filePath, line) =>
      line ? ["--goto", `${filePath}:${line}`] : ["--goto", filePath],
  },
];

const tryLaunchEditorCommand = (command: string, args: string[]): Promise<boolean> => {
  return new Promise((resolve) => {
    let resolved = false;

    try {
      const child = spawn(command, args, {
        detached: true,
        stdio: "ignore",
        windowsHide: true,
      });

      child.once("error", (error) => {
        if (resolved) return;
        resolved = true;
        const err = error as NodeJS.ErrnoException;
        if (err.code !== "ENOENT") {
          console.warn(`Failed to launch ${command}:`, err);
        }
        resolve(false);
      });

      child.once("spawn", () => {
        if (resolved) return;
        resolved = true;
        child.unref();
        resolve(true);
      });
    } catch (error) {
      if (resolved) return;
      resolved = true;
      console.warn(`Failed to launch ${command}:`, error);
      resolve(false);
    }
  });
};

const openFileInExternalEditor = async (filePath: string, line?: number) => {
  for (const launcher of editorLaunchers) {
    const launched = await tryLaunchEditorCommand(launcher.command, launcher.args(filePath, line));
    if (launched) {
      return { success: true as const };
    }
  }

  const fallbackError = await shell.openPath(filePath);
  if (fallbackError) {
    return { success: false as const, error: fallbackError };
  }

  return { success: true as const };
};

export const registerIpcHandlers = (): void => {
  initWorkspaceEvents((channel, payload) => {
    const window = getAppWindow();
    if (window) window.webContents.send(channel, payload);
  });

  ipcMain.handle(IPC.AGENT_START, async (_event, params: AgentStartParams) => {
    try {
      const workspace = workspaceManager.get(params.workspaceId);
      if (!workspace) {
        return { success: false, error: "Workspace not found" };
      }

      const window = getAppWindow();
      if (!window) {
        return { success: false, error: "App window not found" };
      }

      const ALWAYS_APPROVE_BYPASS = new Set(["ask_question"]);

      const canUseTool = async (sessionId: string, toolName: string, input: unknown) => {
        if (!params.requireApproval && !ALWAYS_APPROVE_BYPASS.has(toolName)) {
          return { behavior: "allow" as const, updatedInput: input };
        }
        const requestId = ulid();
        return new Promise<{ behavior: "allow" | "deny"; updatedInput?: unknown; message?: string }>(
          (resolve) => {
            pendingToolApprovals.set(requestId, { resolve, input });
            window.webContents.send(IPC.AGENT_TOOL_APPROVAL_REQUEST, {
              requestId,
              toolName,
              input,
              sessionId,
              workspaceId: params.workspaceId,
            });
          }
        );
      };

      const chat = chatStorage.getChat(params.workspaceId);
      const provider = params.provider ?? "claude";
      const activeThread = params.activeThreadId
        ? chat.threads.find((t) => t.id === params.activeThreadId)
        : undefined;
      const resumeSessionId = activeThread
        ? (activeThread.provider === provider ? activeThread.sdkSessionId : undefined)
        : chat.sdkSessionId;

      const sessionId = await agentManager.start({
        prompt: params.prompt,
        existingMessages: params.existingMessages,
        workspaceId: params.workspaceId,
        workspacePath: workspace.path,
        provider,
        model: params.model,
        mode: params.mode,
        resumeSessionId,
        imageAttachments: params.imageAttachments,
        canUseTool,
        onMessage: (message) => {
          window.webContents.send(IPC.AGENT_MESSAGE, message);
        },
        onResult: (result) => {
          if (result.success && params.activeThreadId) {
            const key = `${params.workspaceId}:${params.activeThreadId}`;
            postRunSnapshotPromises.set(
              key,
              Promise.all([
                gitService.getUntrackedFiles(workspace.path).catch(() => [] as string[]),
                gitService.stashCreate(workspace.path).catch(() => null as string | null),
              ]).then(([untracked, stashSha]) => ({ untracked, stashSha }))
            );
          }
          window.webContents.send(IPC.AGENT_RESULT, result);
        },
        onError: (payload) => {
          window.webContents.send(IPC.AGENT_ERROR, payload);
        },
        onSdkSessionId: (sdkSessionId) => {
          if (params.activeThreadId) {
            const latest = chatStorage.getChat(params.workspaceId);
            const updated = latest.threads.map((t) =>
              t.id === params.activeThreadId
                ? { ...t, sdkSessionId, provider }
                : t
            );
            chatStorage.setChat(params.workspaceId, { threads: updated });
          } else {
            chatStorage.setChat(params.workspaceId, { sdkSessionId });
          }
          window.webContents.send(IPC.AGENT_SDK_SESSION_ID, {
            sdkSessionId,
            threadId: params.activeThreadId ?? "",
            workspaceId: params.workspaceId,
            provider,
          });
        },
      });

      return { success: true, data: { sessionId } };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to start agent",
      };
    }
  });

  ipcMain.handle(IPC.AGENT_STOP, async (_event, sessionId: string) => {
    try {
      await agentManager.stop(sessionId);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to stop agent",
      };
    }
  });

  ipcMain.handle(IPC.AGENT_STATUS, async () => {
    const status = agentManager.getStatus();
    return { success: true, data: status };
  });

  ipcMain.handle(IPC.AGENT_GET_MODELS, async () => {
    try {
      const models = getAllModels();
      return { success: true, data: models };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to get models",
      };
    }
  });

  ipcMain.handle(IPC.WORKSPACE_LIST, async () => {
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
  });

  ipcMain.handle(
    IPC.WORKSPACE_CREATE,
    async (_event, params: { name: string; path: string }) => {
      try {
        const workspace = await workspaceManager.create(params.name, params.path);
        return { success: true, data: workspace };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "Failed to create workspace",
        };
      }
    }
  );

  ipcMain.handle(IPC.WORKSPACE_DELETE, async (_event, id: string) => {
    try {
      if (getActiveWorkspaceId() === id) clearActiveWorkspace();
      chatStorage.removeChat(id);
      workspaceManager.remove(id);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to delete workspace",
      };
    }
  });

  ipcMain.handle(IPC.WORKSPACE_SELECT, async (_event, id: string) => {
    const workspace = workspaceManager.get(id);
    if (!workspace) {
      return { success: false, error: "Workspace not found" };
    }
    try {
      const refreshed = await workspaceManager.refreshGitInfo(id);
      setActiveWorkspace(refreshed.id, refreshed.path);
      return { success: true, data: refreshed };
    } catch {
      setActiveWorkspace(workspace.id, workspace.path);
      return { success: true, data: workspace };
    }
  });

  ipcMain.handle(IPC.WORKSPACE_GIT_REFRESH, async (_event, id: string) => {
    try {
      const workspace = await workspaceManager.refreshGitInfo(id);
      return { success: true, data: workspace };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to refresh git info",
      };
    }
  });

  ipcMain.handle(IPC.WORKSPACE_GIT_BRANCHES, async (_event, id: string) => {
    try {
      const branches = await workspaceManager.getGitBranches(id);
      return { success: true, data: branches };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to get git branches",
      };
    }
  });

  ipcMain.handle(IPC.WORKSPACE_GIT_SWITCH_BRANCH, async (_event, id: string, branchName: string) => {
    try {
      const workspace = await workspaceManager.switchGitBranch(id, branchName);
      return { success: true, data: workspace };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to switch branch",
      };
    }
  });

  ipcMain.handle(IPC.WORKSPACE_GIT_CREATE_BRANCH, async (_event, id: string, branchName: string) => {
    try {
      const workspace = await workspaceManager.createGitBranch(id, branchName);
      return { success: true, data: workspace };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to create branch",
      };
    }
  });

  ipcMain.handle(IPC.WORKSPACE_GIT_UNSTAGED_CHANGES, async (_event, id: string) => {
    try {
      const workspace = workspaceManager.get(id);
      if (!workspace) {
        return { success: false, error: "Workspace not found" };
      }
      const isGit = await gitService.isGitRepository(workspace.path);
      if (!isGit) {
        return { success: true, data: [] };
      }
      const changes = await gitService.getUnstagedNumstat(workspace.path);
      return { success: true, data: changes };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to get unstaged changes",
      };
    }
  });

  ipcMain.handle(
    IPC.WORKSPACE_GET_FILE_DIFF,
    async (_event, workspaceId: string, filePath: string, staged = false) => {
      try {
        const workspace = workspaceManager.get(workspaceId);
        if (!workspace) {
          return { success: false, error: "Workspace not found" };
        }
        const data = await gitService.getFileDiffContent(workspace.path, filePath, staged);
        return { success: true, data };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "Failed to get file diff",
        };
      }
    }
  );

  ipcMain.handle(
    IPC.WORKSPACE_REVERT_FILE_CHANGE,
    async (_event, workspaceId: string, filePath: string) => {
      try {
        const workspace = workspaceManager.get(workspaceId);
        if (!workspace) {
          return { success: false, error: "Workspace not found" };
        }
        await gitService.revertUnstagedFile(workspace.path, filePath);
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "Failed to revert file",
        };
      }
    }
  );

  ipcMain.handle(IPC.WORKSPACE_GIT_STAGED_CHANGES, async (_event, id: string) => {
    try {
      const workspace = workspaceManager.get(id);
      if (!workspace) {
        return { success: false, error: "Workspace not found" };
      }
      const isGit = await gitService.isGitRepository(workspace.path);
      if (!isGit) {
        return { success: true, data: [] };
      }
      const changes = await gitService.getStagedNumstat(workspace.path);
      return { success: true, data: changes };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to get staged changes",
      };
    }
  });

  ipcMain.handle(
    IPC.WORKSPACE_GIT_STAGE_FILE,
    async (_event, workspaceId: string, filePath: string) => {
      try {
        const workspace = workspaceManager.get(workspaceId);
        if (!workspace) {
          return { success: false, error: "Workspace not found" };
        }
        await gitService.stageFile(workspace.path, filePath);
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "Failed to stage file",
        };
      }
    }
  );

  ipcMain.handle(
    IPC.WORKSPACE_GIT_UNSTAGE_FILE,
    async (_event, workspaceId: string, filePath: string) => {
      try {
        const workspace = workspaceManager.get(workspaceId);
        if (!workspace) {
          return { success: false, error: "Workspace not found" };
        }
        await gitService.unstageFile(workspace.path, filePath);
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "Failed to unstage file",
        };
      }
    }
  );

  ipcMain.handle(
    IPC.WORKSPACE_GIT_COMMIT,
    async (_event, workspaceId: string, message: string) => {
      try {
        const workspace = workspaceManager.get(workspaceId);
        if (!workspace) {
          return { success: false, error: "Workspace not found" };
        }
        await gitService.commit(workspace.path, message);
        await workspaceManager.refreshGitInfo(workspace.id);
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "Failed to commit",
        };
      }
    }
  );

  ipcMain.handle(IPC.WORKSPACE_GIT_PUSH, async (_event, workspaceId: string) => {
    try {
      const workspace = workspaceManager.get(workspaceId);
      if (!workspace) {
        return { success: false, error: "Workspace not found" };
      }
      await gitService.push(workspace.path);
      await workspaceManager.refreshGitInfo(workspace.id);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to push",
      };
    }
  });

  ipcMain.handle(
    IPC.TERMINAL_CREATE,
    async (
      _event,
      params: { cwd?: string; cols?: number; rows?: number }
    ) => {
      try {
        const { terminalId, pty } = terminalService.createTerminal(params);
        pty.onData((data) => {
          getAppWindow()?.webContents.send(IPC.TERMINAL_DATA, { terminalId, data });
        });
        pty.onExit(() => {
          terminalService.removeTerminal(terminalId);
        });
        return { success: true, data: { terminalId } };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "Failed to create terminal",
        };
      }
    }
  );

  ipcMain.handle(IPC.TERMINAL_WRITE, async (_event, terminalId: string, data: string) => {
    const ok = terminalService.writeToTerminal(terminalId, data);
    return { success: ok };
  });

  ipcMain.handle(
    IPC.TERMINAL_RESIZE,
    async (_event, terminalId: string, cols: number, rows: number) => {
      const ok = terminalService.resizeTerminal(terminalId, cols, rows);
      return { success: ok };
    }
  );

  ipcMain.handle(IPC.TERMINAL_DESTROY, async (_event, terminalId: string) => {
    const ok = terminalService.destroyTerminal(terminalId);
    return { success: ok };
  });

  ipcMain.handle(IPC.CHAT_LOAD, async (_event, workspaceId: string) => {
    try {
      const data = chatStorage.getChat(workspaceId);
      return { success: true, data };
    } catch {
      return { success: false, error: "Failed to load chat" };
    }
  });

  ipcMain.handle(
    IPC.CHAT_SAVE,
    async (
      _event,
      workspaceId: string,
      data: import("@agentide/shared").ChatData
    ) => {
      try {
        chatStorage.setChat(workspaceId, data);
        return { success: true };
      } catch {
        return { success: false, error: "Failed to save chat" };
      }
    }
  );

  ipcMain.handle(
    IPC.CHAT_DELETE_THREAD,
    async (_event, workspaceId: string, threadId: string) => {
      try {
        chatStorage.deleteThread(workspaceId, threadId);
        const workspace = workspaceManager.get(workspaceId);
        if (workspace) {
          await gitService.deleteCheckpointRefs(workspace.path, threadId).catch(() => {});
        }
        return { success: true };
      } catch {
        return { success: false, error: "Failed to delete thread" };
      }
    }
  );

  ipcMain.handle(IPC.AUTH_LOGIN, async () => {
    try {
      const { execFile } = await import("node:child_process");
      const { promisify } = await import("node:util");
      const execFileAsync = promisify(execFile);
      await execFileAsync("claude", ["login"], {
        timeout: 120_000,
        env: process.env,
      });
      const cli = await configStorage.checkCliLogin();
      if (cli.loggedIn) {
        configStorage.setAuthMethod("claude_login");
        return { success: true, data: { email: cli.email } };
      }
      return { success: false, error: "Login did not complete" };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Login failed",
      };
    }
  });

  ipcMain.handle(IPC.AUTH_STATUS, async () => {
    try {
      const method = configStorage.getAuthMethod();
      const hasKey = configStorage.hasApiKey();
      const cli = await configStorage.checkCliLogin();
      return {
        success: true,
        data: {
          method,
          hasApiKey: hasKey,
          cliLoggedIn: cli.loggedIn,
          cliEmail: cli.email,
        },
      };
    } catch {
      return { success: false, error: "Failed to get auth status" };
    }
  });

  ipcMain.handle(IPC.AUTH_SET_METHOD, async (_event, method: string) => {
    try {
      if (method !== "api_key" && method !== "claude_login") {
        return { success: false, error: "Invalid auth method" };
      }
      configStorage.setAuthMethod(method);
      return { success: true };
    } catch {
      return { success: false, error: "Failed to set auth method" };
    }
  });

  ipcMain.handle(IPC.API_KEY_GET, async () => {
    try {
      const key = configStorage.getApiKey();
      return { success: true, data: key };
    } catch {
      return { success: false, error: "Failed to get API key" };
    }
  });

  ipcMain.handle(IPC.API_KEY_SET, async (_event, apiKey: string | null) => {
    try {
      configStorage.setApiKey(apiKey);
      return { success: true };
    } catch {
      return { success: false, error: "Failed to save API key" };
    }
  });

  ipcMain.handle(IPC.API_KEY_HAS, async () => {
    try {
      return { success: true, data: configStorage.hasApiKey() };
    } catch {
      return { success: false, error: "Failed to check API key" };
    }
  });

  ipcMain.handle(IPC.CODEX_API_KEY_GET, async () => {
    try {
      const key = configStorage.getCodexApiKey();
      return { success: true, data: key };
    } catch {
      return { success: false, error: "Failed to get Codex API key" };
    }
  });

  ipcMain.handle(IPC.CODEX_API_KEY_SET, async (_event, apiKey: string | null) => {
    try {
      configStorage.setCodexApiKey(apiKey);
      return { success: true };
    } catch {
      return { success: false, error: "Failed to save Codex API key" };
    }
  });

  ipcMain.handle(IPC.CODEX_API_KEY_HAS, async () => {
    try {
      return { success: true, data: configStorage.hasCodexApiKey() };
    } catch {
      return { success: false, error: "Failed to check Codex API key" };
    }
  });

  ipcMain.handle(IPC.CONFIG_GET_ACTIVE_WORKSPACE, async () => {
    try {
      const id = configStorage.getActiveWorkspaceId();
      return { success: true, data: id };
    } catch {
      return { success: false, error: "Failed to load config" };
    }
  });

  ipcMain.handle(
    IPC.CONFIG_SET_ACTIVE_WORKSPACE,
    async (_event, workspaceId: string | null) => {
      try {
        configStorage.setActiveWorkspaceId(workspaceId);
        return { success: true };
      } catch {
        return { success: false, error: "Failed to save config" };
      }
    }
  );

  ipcMain.handle(IPC.DIALOG_SELECT_FOLDER, async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      properties: ["openDirectory"],
      title: "Select project directory",
    });
    if (canceled || filePaths.length === 0) {
      return { success: true, data: null };
    }
    return { success: true, data: filePaths[0] ?? null };
  });

  ipcMain.handle(IPC.READ_DIRECTORY_TREE, async (_event, dirPath: string) => {
    try {
      const tree = await readDirectoryTree(dirPath);
      return { success: true, data: tree };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to read directory tree",
      };
    }
  });

  ipcMain.handle(IPC.READ_FILE, async (_event, filePath: string) => {
    try {
      const stat = await fs.stat(filePath);
      if (!stat.isFile()) {
        return { success: false, error: "Path is not a file" };
      }
      const content = await fs.readFile(filePath, "utf-8");
      return { success: true, data: content };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to read file",
      };
    }
  });

  ipcMain.handle(IPC.SKILLS_LIST, async () => {
    try {
      const home = os.homedir();
      const cursorSkills = await loadSkillsFromDir(
        path.join(home, ".cursor", "skills")
      );
      const claudeSkills = await loadSkillsFromDir(
        path.join(home, ".claude", "skills")
      );
      const byId = new Map<string, AgentSkillItem>();
      for (const s of [...cursorSkills, ...claudeSkills]) {
        if (!byId.has(s.id)) byId.set(s.id, s);
      }
      return { success: true, data: Array.from(byId.values()) };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to list skills",
      };
    }
  });

  ipcMain.handle(IPC.SKILLS_GET_CONTENT, async (_event, skillId: string) => {
    try {
      const home = os.homedir();
      const dirs = [
        path.join(home, ".cursor", "skills"),
        path.join(home, ".claude", "skills"),
      ];
      for (const dir of dirs) {
        const skillMdPath = path.join(dir, skillId, SKILL_MD);
        try {
          const stat = await fs.stat(skillMdPath);
          if (stat.isFile()) {
            const content = await fs.readFile(skillMdPath, "utf-8");
            return { success: true, data: content };
          }
        } catch {
          continue;
        }
      }
      return { success: false, error: `Skill "${skillId}" not found` };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to read skill",
      };
    }
  });

  ipcMain.handle(
    IPC.CHECKPOINT_CREATE,
    async (
      _event,
      params: { workspaceId: string; activeThreadId: string; messageIndex: number }
    ) => {
      try {
        const workspace = workspaceManager.get(params.workspaceId);
        if (!workspace) {
          return { success: false, error: "Workspace not found" };
        }

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
            .getModifiedFilesBetween(workspace.path, prevCheckpoint.gitStashRef ?? null, gitStashRef ?? null)
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
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "Failed to create checkpoint",
        };
      }
    }
  );

  ipcMain.handle(
    IPC.CHECKPOINT_FINALIZE,
    async (_event, params: { workspaceId: string; threadId: string }) => {
      try {
        const workspace = workspaceManager.get(params.workspaceId);
        if (!workspace) return { success: false, error: "Workspace not found" };

        const chat = chatStorage.getChat(params.workspaceId);
        const thread = chat.threads.find((t) => t.id === params.threadId);
        if (!thread) return { success: false, error: "Thread not found" };

        const checkpoint = thread.checkpoints?.slice().reverse().find((c) => !c.modifiedFiles);
        if (!checkpoint) return { success: true, data: null };

        const snapshotKey = `${params.workspaceId}:${params.threadId}`;
        const postRun = await postRunSnapshotPromises.get(snapshotKey)?.catch(() => null) ?? null;
        postRunSnapshotPromises.delete(snapshotKey);

        const postRunUntracked = postRun?.untracked
          ?? await gitService.getUntrackedFiles(workspace.path).catch(() => [] as string[]);
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
                  c.id === checkpoint.id
                    ? { ...c, modifiedFiles: modified, createdFiles: created }
                    : c
                ),
              }
            : t
        );
        chatStorage.setChat(params.workspaceId, { threads: updatedThreads });

        return {
          success: true,
          data: { checkpointId: checkpoint.id, modifiedFiles: modified, createdFiles: created },
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "Failed to finalize checkpoint",
        };
      }
    }
  );

  ipcMain.handle(
    IPC.CHECKPOINT_RESTORE,
    async (
      _event,
      params: {
        workspaceId: string;
        stashRef: string | null;
        modifiedFiles?: string[];
        createdFiles?: string[];
      }
    ) => {
      try {
        const workspace = workspaceManager.get(params.workspaceId);
        if (!workspace) {
          return { success: false, error: "Workspace not found" };
        }
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
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "Failed to restore checkpoint",
        };
      }
    }
  );

  ipcMain.handle(IPC.AGENT_TOOL_APPROVAL_RESPONSE, async (_event, response: ToolApprovalResponse) => {
      const pending = pendingToolApprovals.get(response.requestId);
      if (!pending) return;
      pendingToolApprovals.delete(response.requestId);
      if (response.allow) {
        pending.resolve({
          behavior: "allow",
          updatedInput: response.updatedInput ?? pending.input,
        });
      } else {
        pending.resolve({
          behavior: "deny",
          message: response.message ?? "Denied",
        });
      }
    }
  );

  ipcMain.handle(IPC.EDITOR_OPEN_FILE, async (_event, filePath: string, line?: number) => {
    try {
      return await openFileInExternalEditor(filePath, line);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to open file in editor",
      };
    }
  });

  ipcMain.handle(IPC.AGENT_LOG_GET_PATH, async () => {
    try {
      const logPath = getAgentLogPath();
      return { success: true as const, data: logPath };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to get log path",
      };
    }
  });

  ipcMain.handle(IPC.AGENT_LOG_READ, async () => {
    try {
      const logPath = getAgentLogPath();
      const content = await fs.readFile(logPath, "utf-8").catch(() => "");
      return { success: true as const, data: content };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to read log",
      };
    }
  });

  ipcMain.handle(IPC.AGENT_LOG_OPEN_FOLDER, async () => {
    try {
      const logDir = getAgentLogDir();
      await shell.openPath(logDir);
      return { success: true as const };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to open log folder",
      };
    }
  });
};

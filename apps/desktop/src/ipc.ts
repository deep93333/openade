import { dialog, ipcMain } from "electron";
import { IPC } from "@agentide/shared";
import type { AgentStartParams, FileTreeNode, ToolApprovalResponse } from "@agentide/shared";
import { ulid } from "ulid";
import { agentManager } from "./services/agent-manager";
import * as chatStorage from "./services/chat-storage";
import { workspaceManager } from "./services/workspace-manager";
import { getAppWindow } from "./windows/app-window";
import * as path from "path";
import * as fs from "fs/promises";

const pendingToolApprovals = new Map<
  string,
  { resolve: (r: { behavior: "allow" | "deny"; updatedInput?: unknown; message?: string }) => void; input: unknown }
>();

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

    // Filter out hidden files and common build/cache directories
    const filteredEntries = entries.filter(entry => {
      const name = entry.name;
      return !name.startsWith('.') &&
             name !== 'node_modules' &&
             name !== 'dist' &&
             name !== 'build' &&
             name !== '.git' &&
             name !== 'coverage';
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

export const registerIpcHandlers = (): void => {
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

      const canUseTool = params.requireApproval
        ? async (toolName: string, input: unknown) => {
            const requestId = ulid();
            return new Promise<{ behavior: "allow" | "deny"; updatedInput?: unknown; message?: string }>(
              (resolve) => {
                pendingToolApprovals.set(requestId, { resolve, input });
                window.webContents.send(IPC.AGENT_TOOL_APPROVAL_REQUEST, {
                  requestId,
                  toolName,
                  input,
                });
              }
            );
          }
        : undefined;

      const chat = chatStorage.getChat(params.workspaceId);
      const resumeSessionId =
        (params.activeThreadId
          ? chat.threads.find((t) => t.id === params.activeThreadId)
              ?.sdkSessionId
          : undefined) ?? chat.sdkSessionId;

      const sessionId = await agentManager.start({
        prompt: params.prompt,
        workspaceId: params.workspaceId,
        workspacePath: workspace.path,
        model: params.model,
        resumeSessionId,
        canUseTool,
        onMessage: (message) => {
          window.webContents.send(IPC.AGENT_MESSAGE, message);
        },
        onResult: (result) => {
          window.webContents.send(IPC.AGENT_RESULT, result);
        },
        onError: (error) => {
          window.webContents.send(IPC.AGENT_ERROR, error);
        },
        onSdkSessionId: (sdkSessionId) => {
          if (params.activeThreadId) {
            const latest = chatStorage.getChat(params.workspaceId);
            const updated = latest.threads.map((t) =>
              t.id === params.activeThreadId
                ? { ...t, sdkSessionId }
                : t
            );
            chatStorage.setChat(params.workspaceId, { threads: updated });
          } else {
            chatStorage.setChat(params.workspaceId, { sdkSessionId });
          }
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

  ipcMain.handle(IPC.WORKSPACE_LIST, async () => {
    const workspaces = workspaceManager.list();
    return { success: true, data: workspaces };
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
    return { success: true, data: workspace };
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

  ipcMain.handle(
    IPC.AGENT_TOOL_APPROVAL_RESPONSE,
    async (_event, response: ToolApprovalResponse) => {
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
};

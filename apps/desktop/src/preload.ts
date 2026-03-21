import { IPC } from "@agentide/shared";
import type { ApiKeyProvider, AuthMethod, ChatData } from "@agentide/shared";
import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electronAPI", {
  config: {
    getActiveWorkspaceId: () => ipcRenderer.invoke(IPC.CONFIG_GET_ACTIVE_WORKSPACE),
    setActiveWorkspaceId: (workspaceId: string | null) =>
      ipcRenderer.invoke(IPC.CONFIG_SET_ACTIVE_WORKSPACE, workspaceId),
  },
  apiKey: {
    get: () => ipcRenderer.invoke(IPC.API_KEY_GET),
    set: (apiKey: string | null) => ipcRenderer.invoke(IPC.API_KEY_SET, apiKey),
    has: () => ipcRenderer.invoke(IPC.API_KEY_HAS),
  },
  codexApiKey: {
    get: () => ipcRenderer.invoke(IPC.CODEX_API_KEY_GET),
    set: (apiKey: string | null) => ipcRenderer.invoke(IPC.CODEX_API_KEY_SET, apiKey),
    has: () => ipcRenderer.invoke(IPC.CODEX_API_KEY_HAS),
  },
  minimaxApiKey: {
    get: () => ipcRenderer.invoke(IPC.MINIMAX_API_KEY_GET),
    set: (apiKey: string | null) => ipcRenderer.invoke(IPC.MINIMAX_API_KEY_SET, apiKey),
    has: () => ipcRenderer.invoke(IPC.MINIMAX_API_KEY_HAS),
  },
  apiKeys: {
    get: (provider: ApiKeyProvider) => ipcRenderer.invoke(IPC.API_KEYS_GET, provider),
    set: (provider: ApiKeyProvider, apiKey: string | null) =>
      ipcRenderer.invoke(IPC.API_KEYS_SET, provider, apiKey),
    has: (provider: ApiKeyProvider) => ipcRenderer.invoke(IPC.API_KEYS_HAS, provider),
  },
  auth: {
    status: () => ipcRenderer.invoke(IPC.AUTH_STATUS),
    setMethod: (method: AuthMethod) => ipcRenderer.invoke(IPC.AUTH_SET_METHOD, method),
    login: () => ipcRenderer.invoke(IPC.AUTH_LOGIN),
  },
  settings: {
    get: () => ipcRenderer.invoke(IPC.SETTINGS_GET),
    set: (settings: import("@agentide/shared").GlobalSettings) =>
      ipcRenderer.invoke(IPC.SETTINGS_SET, settings),
    validateMcpServers: (servers: import("@agentide/shared").MCPServerConfig[]) =>
      ipcRenderer.invoke(IPC.SETTINGS_VALIDATE_MCP_SERVERS, servers),
  },
  chat: {
    load: (workspaceId: string) => ipcRenderer.invoke(IPC.CHAT_LOAD, workspaceId),
    save: (workspaceId: string, data: ChatData) =>
      ipcRenderer.invoke(IPC.CHAT_SAVE, workspaceId, data),
    deleteThread: (workspaceId: string, threadId: string) =>
      ipcRenderer.invoke(IPC.CHAT_DELETE_THREAD, workspaceId, threadId),
    updateMessage: (
      workspaceId: string,
      threadId: string,
      messageId: string,
      updates: Partial<
        Pick<import("@agentide/shared").AgentMessage, "content" | "planContent" | "reviewContent">
      >
    ) => ipcRenderer.invoke(IPC.CHAT_UPDATE_MESSAGE, workspaceId, threadId, messageId, updates),
  },
  workspace: {
    list: () => ipcRenderer.invoke(IPC.WORKSPACE_LIST),

    create: (params: { name: string; path: string }) =>
      ipcRenderer.invoke(IPC.WORKSPACE_CREATE, params),

    delete: (id: string) => ipcRenderer.invoke(IPC.WORKSPACE_DELETE, id),

    select: (id: string) => ipcRenderer.invoke(IPC.WORKSPACE_SELECT, id),

    refreshGit: (id: string) => ipcRenderer.invoke(IPC.WORKSPACE_GIT_REFRESH, id),

    getBranches: (id: string) => ipcRenderer.invoke(IPC.WORKSPACE_GIT_BRANCHES, id),

    switchBranch: (id: string, branchName: string) =>
      ipcRenderer.invoke(IPC.WORKSPACE_GIT_SWITCH_BRANCH, id, branchName),

    createBranch: (id: string, branchName: string) =>
      ipcRenderer.invoke(IPC.WORKSPACE_GIT_CREATE_BRANCH, id, branchName),

    initializeGit: (id: string) => ipcRenderer.invoke(IPC.WORKSPACE_GIT_INIT, id),

    getUnstagedChanges: (id: string) => ipcRenderer.invoke(IPC.WORKSPACE_GIT_UNSTAGED_CHANGES, id),

    getStagedChanges: (id: string) => ipcRenderer.invoke(IPC.WORKSPACE_GIT_STAGED_CHANGES, id),

    getFileDiffContent: (workspaceId: string, filePath: string, staged = false) =>
      ipcRenderer.invoke(IPC.WORKSPACE_GET_FILE_DIFF, workspaceId, filePath, staged),

    revertFileChange: (workspaceId: string, filePath: string) =>
      ipcRenderer.invoke(IPC.WORKSPACE_REVERT_FILE_CHANGE, workspaceId, filePath),

    stageFile: (workspaceId: string, filePath: string) =>
      ipcRenderer.invoke(IPC.WORKSPACE_GIT_STAGE_FILE, workspaceId, filePath),

    unstageFile: (workspaceId: string, filePath: string) =>
      ipcRenderer.invoke(IPC.WORKSPACE_GIT_UNSTAGE_FILE, workspaceId, filePath),

    commit: (workspaceId: string, message: string) =>
      ipcRenderer.invoke(IPC.WORKSPACE_GIT_COMMIT, workspaceId, message),

    push: (workspaceId: string) => ipcRenderer.invoke(IPC.WORKSPACE_GIT_PUSH, workspaceId),

    getAheadCount: (workspaceId: string) =>
      ipcRenderer.invoke(IPC.WORKSPACE_GIT_AHEAD_COUNT, workspaceId),

    onFilesChanged: (callback: (payload: { workspaceId: string }) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, payload: { workspaceId: string }) =>
        callback(payload);
      ipcRenderer.on(IPC.WORKSPACE_FILES_CHANGED, handler);
      return () => ipcRenderer.removeListener(IPC.WORKSPACE_FILES_CHANGED, handler);
    },

    onGitChanged: (callback: (payload: { workspaceId: string }) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, payload: { workspaceId: string }) =>
        callback(payload);
      ipcRenderer.on(IPC.WORKSPACE_GIT_CHANGED, handler);
      return () => ipcRenderer.removeListener(IPC.WORKSPACE_GIT_CHANGED, handler);
    },
  },

  filesystem: {
    readDirectoryTree: (path: string, maxDepth?: number) =>
      ipcRenderer.invoke(IPC.READ_DIRECTORY_TREE, path, maxDepth),
    readDirectoryChildren: (dirPath: string) =>
      ipcRenderer.invoke(IPC.READ_DIRECTORY_CHILDREN, dirPath),
    readFile: (path: string) => ipcRenderer.invoke(IPC.READ_FILE, path),
  },

  dialog: {
    selectFolder: () => ipcRenderer.invoke(IPC.DIALOG_SELECT_FOLDER),
  },

  project: {
    createEmpty: (parentDir: string, folderName: string) =>
      ipcRenderer.invoke(IPC.PROJECT_CREATE_EMPTY, parentDir, folderName),
    clone: (repoUrl: string, parentDir: string) =>
      ipcRenderer.invoke(IPC.PROJECT_CLONE, repoUrl, parentDir),
  },

  terminal: {
    create: (params: { cwd?: string; cols?: number; rows?: number }) =>
      ipcRenderer.invoke(IPC.TERMINAL_CREATE, params),
    write: (terminalId: string, data: string) =>
      ipcRenderer.invoke(IPC.TERMINAL_WRITE, terminalId, data),
    resize: (terminalId: string, cols: number, rows: number) =>
      ipcRenderer.invoke(IPC.TERMINAL_RESIZE, terminalId, cols, rows),
    destroy: (terminalId: string) => ipcRenderer.invoke(IPC.TERMINAL_DESTROY, terminalId),
    onData: (callback: (payload: { terminalId: string; data: string }) => void) => {
      const handler = (
        _event: Electron.IpcRendererEvent,
        payload: { terminalId: string; data: string }
      ) => callback(payload);
      ipcRenderer.on(IPC.TERMINAL_DATA, handler);
      return () => ipcRenderer.removeListener(IPC.TERMINAL_DATA, handler);
    },
  },

  skills: {
    list: () => ipcRenderer.invoke(IPC.SKILLS_LIST),
    getContent: (skillId: string) => ipcRenderer.invoke(IPC.SKILLS_GET_CONTENT, skillId),
  },

  checkpoint: {
    create: (params: { workspaceId: string; activeThreadId: string; messageIndex: number }) =>
      ipcRenderer.invoke(IPC.CHECKPOINT_CREATE, params),
    capturePostRun: (params: { workspaceId: string; threadId: string }) =>
      ipcRenderer.invoke(IPC.CHECKPOINT_CAPTURE_POST_RUN, params),
    finalize: (params: { workspaceId: string; threadId: string }) =>
      ipcRenderer.invoke(IPC.CHECKPOINT_FINALIZE, params),
    restore: (params: {
      workspaceId: string;
      stashRef: string | null;
      modifiedFiles?: string[];
      createdFiles?: string[];
    }) => ipcRenderer.invoke(IPC.CHECKPOINT_RESTORE, params),
  },
  agentLog: {
    getPath: () => ipcRenderer.invoke(IPC.AGENT_LOG_GET_PATH),
    read: () => ipcRenderer.invoke(IPC.AGENT_LOG_READ),
    openFolder: () => ipcRenderer.invoke(IPC.AGENT_LOG_OPEN_FOLDER),
  },
  editor: {
    openFile: (filePath: string, line?: number) =>
      ipcRenderer.invoke(IPC.EDITOR_OPEN_FILE, filePath, line),
  },
});

import type {
  AgentMessage,
  AgentSkillItem,
  ApiKeyProvider,
  ChatData,
  Checkpoint,
  FileDiffContent,
  FileTreeNode,
  GitBranch,
  GitStagedChange,
  GitUnstagedChange,
  IpcResult,
  Workspace,
} from "./types.js";

export type ElectronAPI = {
  config: {
    getActiveWorkspaceId: () => Promise<IpcResult<string | null>>;
    setActiveWorkspaceId: (workspaceId: string | null) => Promise<IpcResult>;
  };
  apiKey: {
    get: () => Promise<IpcResult<string | null>>;
    set: (apiKey: string | null) => Promise<IpcResult>;
    has: () => Promise<IpcResult<boolean>>;
  };
  codexApiKey: {
    get: () => Promise<IpcResult<string | null>>;
    set: (apiKey: string | null) => Promise<IpcResult>;
    has: () => Promise<IpcResult<boolean>>;
  };
  minimaxApiKey: {
    get: () => Promise<IpcResult<string | null>>;
    set: (apiKey: string | null) => Promise<IpcResult>;
    has: () => Promise<IpcResult<boolean>>;
  };
  apiKeys: {
    get: (provider: ApiKeyProvider) => Promise<IpcResult<string | null>>;
    set: (provider: ApiKeyProvider, apiKey: string | null) => Promise<IpcResult>;
    has: (provider: ApiKeyProvider) => Promise<IpcResult<boolean>>;
  };
  auth: {
    status: () => Promise<IpcResult<import("./types.js").AuthStatus>>;
    setMethod: (method: import("./types.js").AuthMethod) => Promise<IpcResult>;
    login: () => Promise<IpcResult<{ email?: string }>>;
  };
  settings: {
    get: () => Promise<IpcResult<import("./types.js").GlobalSettings>>;
    set: (settings: import("./types.js").GlobalSettings) => Promise<IpcResult>;
    validateMcpServers: (
      servers: import("./types.js").MCPServerConfig[]
    ) => Promise<IpcResult<import("./types.js").MCPValidationResult>>;
  };
  chat: {
    load: (workspaceId: string) => Promise<IpcResult<ChatData>>;
    save: (workspaceId: string, data: ChatData) => Promise<IpcResult>;
    deleteThread: (workspaceId: string, threadId: string) => Promise<IpcResult>;
    updateMessage: (
      workspaceId: string,
      threadId: string,
      messageId: string,
      updates: Partial<Pick<AgentMessage, "content" | "planContent" | "reviewContent">>
    ) => Promise<IpcResult>;
  };
  workspace: {
    list: () => Promise<IpcResult<Workspace[]>>;
    create: (params: { name: string; path: string }) => Promise<IpcResult<Workspace>>;
    delete: (id: string) => Promise<IpcResult>;
    select: (id: string) => Promise<IpcResult<Workspace>>;
    refreshGit: (id: string) => Promise<IpcResult<Workspace>>;
    getBranches: (id: string) => Promise<IpcResult<GitBranch[]>>;
    switchBranch: (id: string, branchName: string) => Promise<IpcResult<Workspace>>;
    createBranch: (id: string, branchName: string) => Promise<IpcResult<Workspace>>;
    initializeGit: (id: string) => Promise<IpcResult<Workspace>>;
    getUnstagedChanges: (id: string) => Promise<IpcResult<GitUnstagedChange[]>>;
    getStagedChanges: (id: string) => Promise<IpcResult<GitStagedChange[]>>;
    getFileDiffContent: (
      workspaceId: string,
      path: string,
      staged?: boolean
    ) => Promise<IpcResult<FileDiffContent>>;
    revertFileChange: (workspaceId: string, path: string) => Promise<IpcResult>;
    stageFile: (workspaceId: string, path: string) => Promise<IpcResult>;
    unstageFile: (workspaceId: string, path: string) => Promise<IpcResult>;
    commit: (workspaceId: string, message: string) => Promise<IpcResult>;
    push: (workspaceId: string) => Promise<IpcResult>;
    getAheadCount: (workspaceId: string) => Promise<IpcResult<number>>;
    onFilesChanged: (callback: (payload: { workspaceId: string }) => void) => () => void;
    onGitChanged: (callback: (payload: { workspaceId: string }) => void) => () => void;
  };
  filesystem: {
    readDirectoryTree: (path: string, maxDepth?: number) => Promise<IpcResult<FileTreeNode>>;
    readDirectoryChildren: (dirPath: string) => Promise<IpcResult<FileTreeNode[]>>;
    readFile: (path: string) => Promise<IpcResult<string>>;
  };
  dialog: {
    selectFolder: () => Promise<IpcResult<string | null>>;
  };
  project: {
    createEmpty: (parentDir: string, folderName: string) => Promise<IpcResult<string>>;
    clone: (repoUrl: string, parentDir: string) => Promise<IpcResult<string>>;
  };
  terminal: {
    create: (params: { cwd?: string; cols?: number; rows?: number }) => Promise<
      IpcResult<{ terminalId: string }>
    >;
    write: (terminalId: string, data: string) => Promise<IpcResult>;
    resize: (terminalId: string, cols: number, rows: number) => Promise<IpcResult>;
    destroy: (terminalId: string) => Promise<IpcResult>;
    onData: (callback: (payload: { terminalId: string; data: string }) => void) => () => void;
  };
  skills: {
    list: () => Promise<IpcResult<AgentSkillItem[]>>;
    getContent: (skillId: string) => Promise<IpcResult<string>>;
  };
  checkpoint: {
    create: (params: {
      workspaceId: string;
      activeThreadId: string;
      messageIndex: number;
    }) => Promise<IpcResult<{ checkpoint: Checkpoint; finalizedPrev: Checkpoint | null }>>;
    capturePostRun: (params: { workspaceId: string; threadId: string }) => Promise<IpcResult>;
    finalize: (params: {
      workspaceId: string;
      threadId: string;
    }) => Promise<
      IpcResult<{ checkpointId: string; modifiedFiles: string[]; createdFiles: string[] } | null>
    >;
    restore: (params: {
      workspaceId: string;
      stashRef: string | null;
      modifiedFiles?: string[];
      createdFiles?: string[];
    }) => Promise<IpcResult>;
  };
  agentLog: {
    getPath: () => Promise<IpcResult<string>>;
    read: () => Promise<IpcResult<string>>;
    openFolder: () => Promise<IpcResult>;
  };
  editor: {
    openFile: (filePath: string, line?: number) => Promise<IpcResult>;
  };
};

export type WindowWithElectronAPI = {
  electronAPI: ElectronAPI;
};

import type {
  AgentMessage,
  AgentResult,
  AgentStartParams,
  AgentStatus,
  ChatData,
  FileTreeNode,
  GitBranch,
  IpcResult,
  ToolApprovalRequest,
  ToolApprovalResponse,
  Workspace,
} from "./types.js";

export type ElectronAPI = {
  chat: {
    load: (workspaceId: string) => Promise<IpcResult<ChatData>>;
    save: (workspaceId: string, data: ChatData) => Promise<IpcResult>;
  };
  agent: {
    start: (params: AgentStartParams) => Promise<IpcResult<{ sessionId: string }>>;
    stop: (sessionId: string) => Promise<IpcResult>;
    status: () => Promise<IpcResult<{ status: AgentStatus; sessionId?: string }>>;
    onMessage: (callback: (message: AgentMessage) => void) => () => void;
    onResult: (callback: (result: AgentResult) => void) => () => void;
    onError: (callback: (error: string) => void) => () => void;
    onToolApprovalRequest: (callback: (request: ToolApprovalRequest) => void) => () => void;
    respondToolApproval: (response: ToolApprovalResponse) => Promise<void>;
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
  };
  filesystem: {
    readDirectoryTree: (path: string) => Promise<IpcResult<FileTreeNode>>;
    readFile: (path: string) => Promise<IpcResult<string>>;
  };
  dialog: {
    selectFolder: () => Promise<IpcResult<string | null>>;
  };
};

export type WindowWithElectronAPI = {
  electronAPI: ElectronAPI;
};

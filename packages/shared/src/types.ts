export type AgentStatus = "idle" | "running" | "error" | "stopped";

export type AgentMessageRole = "user" | "assistant" | "system" | "tool";

export type AgentMessage = {
  id: string;
  role: AgentMessageRole;
  content: string;
  timestamp: number;
  toolName?: string;
  toolInput?: unknown;
  toolResult?: unknown;
  isPartial?: boolean;
  sessionId?: string;
};

export type AgentSession = {
  id: string;
  workspaceId: string;
  status: AgentStatus;
  messages: AgentMessage[];
  createdAt: number;
  totalCostUsd?: number;
};

export type Workspace = {
  id: string;
  name: string;
  path: string;
  createdAt: number;
  branch?: string;
  activeSessionId?: string;
};

export type AgentStartParams = {
  prompt: string;
  workspaceId: string;
  activeThreadId?: string;
  model?: string;
  requireApproval?: boolean;
};

export type ToolApprovalRequest = {
  requestId: string;
  toolName: string;
  input: unknown;
};

export type ToolApprovalResponse = {
  requestId: string;
  allow: boolean;
  updatedInput?: unknown;
  message?: string;
};

export type AgentResult = {
  sessionId: string;
  success: boolean;
  result?: string;
  error?: string;
  totalCostUsd?: number;
};

export type ChatThread = {
  id: string;
  messages: AgentMessage[];
  createdAt: number;
  title?: string;
  sdkSessionId?: string;
};

export type ChatData = {
  threads: ChatThread[];
  activeThreadId: string;
  sdkSessionId?: string;
};

export type IpcResult<T = unknown> = {
  success: boolean;
  data?: T;
  error?: string;
};

export type FileTreeNode = {
  name: string;
  path: string;
  type: "file" | "directory";
  children?: FileTreeNode[];
};

export type GitBranch = {
  name: string;
  current: boolean;
  remote?: string;
};

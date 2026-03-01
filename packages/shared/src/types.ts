export type AgentStatus = "idle" | "running" | "error" | "stopped";

export type AuthMethod = "api_key" | "claude_login" | "codex_api_key" | "codex_login";

export type AuthStatus = {
  method: AuthMethod;
  hasApiKey: boolean;
  cliLoggedIn: boolean;
  cliEmail?: string;
};

export type TaskStatus = "backlog" | "in_progress" | "in_review" | "completed";

export type AgentMessageRole = "user" | "assistant" | "system" | "tool";

export type ImageAttachment = {
  id: string;
  name: string;
  size: number;
  type: string; // MIME type (image/jpeg, image/png, etc.)
  dataUrl: string; // base64 data URL for display
  file?: File; // Original file object (only available in browser)
};

export type ToolMessageStatus = "pending" | "running" | "completed" | "cancelled" | "failed";

export type AgentMessage = {
  id: string;
  role: AgentMessageRole;
  content: string;
  timestamp: number;
  toolName?: string;
  toolInput?: unknown;
  toolResult?: unknown;
  toolCallId?: string;
  toolStatus?: ToolMessageStatus;
  isPartial?: boolean;
  sessionId?: string;
  imageAttachments?: ImageAttachment[];
  inputTokens?: number;
  outputTokens?: number;
  costUsd?: number;
  planContent?: string;
  agentMode?: AgentMode;
};

export type Workspace = {
  id: string;
  name: string;
  path: string;
  createdAt: number;
  branch?: string;
};

export type AgentMode = "ask" | "plan" | "agent";

export type AgentProvider = "claude" | "codex" | "minimax";

export type AgentModelOption = {
  value: string;
  label: string;
  provider: AgentProvider;
};

export type AgentStartParams = {
  prompt: string;
  workspaceId: string;
  activeThreadId?: string;
  existingMessages?: AgentMessage[];
  model?: string;
  mode?: AgentMode;
  provider?: AgentProvider;
  requireApproval?: boolean;
  resumeSessionId?: string;
  imageAttachments?: ImageAttachment[];
};

export type AgentErrorPayload = {
  sessionId: string;
  error: string;
};

export type SdkSessionIdPayload = {
  sdkSessionId: string;
  threadId: string;
  workspaceId?: string;
  provider?: AgentProvider;
};

export type ToolApprovalRequest = {
  requestId: string;
  toolName: string;
  input: unknown;
  sessionId?: string;
  workspaceId?: string;
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
  inputTokens?: number;
  outputTokens?: number;
};

export type Checkpoint = {
  id: string;
  threadId: string;
  messageIndex: number;
  timestamp: number;
  baseHead?: string;
  gitStashRef?: string;
  untrackedAtCheckpoint?: string[];
  modifiedFiles?: string[];
  createdFiles?: string[];
};

export type ChatThread = {
  id: string;
  messages: AgentMessage[];
  createdAt: number;
  title?: string;
  sdkSessionId?: string;
  provider?: AgentProvider;
  checkpoints?: Checkpoint[];
  taskStatus?: TaskStatus;
  inputTokens?: number;
  outputTokens?: number;
  lastRunInputTokens?: number;
  lastRunOutputTokens?: number;
};

export type ChatData = {
  threads: ChatThread[];
  activeThreadId: string;
  sdkSessionId?: string;
};

export type AgentSkillItem = {
  id: string;
  name: string;
  description: string;
  skillPath?: string;
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

export type GitUnstagedChange = {
  path: string;
  added: number;
  deleted: number;
};

export type GitStagedChange = {
  path: string;
  added: number;
  deleted: number;
};

export type FileDiffContent = {
  oldContent: string;
  newContent: string;
};

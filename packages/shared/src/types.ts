export type AgentStatus = "idle" | "running" | "error" | "stopped";

export type AuthMethod = "api_key" | "claude_login" | "codex_api_key" | "codex_login";

export type AuthStatus = {
  method: AuthMethod;
  hasApiKey: boolean;
  cliLoggedIn: boolean;
  cliEmail?: string;
};

export type ThemeAppearance = "light" | "dark" | "system";

export type GlobalSettings = {
  mcpServers: MCPServerConfig[];
  commitMessageModel?: string;
  commitMessageProvider?: AgentProvider;
  moonshotBaseUrl?: string;
  appearance?: ThemeAppearance;
};

export type TaskStatus = "brainstorm" | "backlog" | "planning" | "in_progress" | "agent_review" | "in_review" | "completed" | "archived";

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

export type ContextMessageSummary = {
  id: string;
  role: AgentMessageRole;
  preview: string;
  toolName?: string;
  timestamp: number;
};

export type AgentMessageContextInfo = {
  prompt: string;
  previousMessages: number;
  systemPrompt?: string;
  generatedSystemPrompt?: string;
  messageSummaries?: ContextMessageSummary[];
  estimatedTokens?: number;
  wasCompacted?: boolean;
};

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
  isMeta?: boolean;
  metaType?: "generated_system_prompt";
  imageAttachments?: ImageAttachment[];
  inputTokens?: number;
  outputTokens?: number;
  costUsd?: number;
  planContent?: string;
  reviewContent?: string;
  agentMode?: AgentMode;
  contextInfo?: AgentMessageContextInfo;
};

export type Workspace = {
  id: string;
  name: string;
  path: string;
  createdAt: number;
  isGitRepository: boolean;
  branch?: string;
};

export type AgentMode = "ask" | "plan" | "agent" | "agent_review";

export type AgentProvider = "claude" | "codex" | "minimax" | "moonshot";

export type ApiKeyProvider = "claude" | "codex" | "minimax" | "moonshot";

export type ProviderConfig = {
  id: ApiKeyProvider;
  name: string;
  icon: string;
  keyPrefix?: string;
  keyPlaceholder: string;
  helpUrl?: string;
  helpText?: string;
};

export const PROVIDER_CONFIGS: ProviderConfig[] = [
  {
    id: "claude",
    name: "Claude",
    icon: "IconUserCircle",
    keyPrefix: "sk-",
    keyPlaceholder: "sk-ant-...",
    helpUrl: "https://console.anthropic.com/settings/keys",
    helpText: "Get a key from console.anthropic.com",
  },
  {
    id: "codex",
    name: "Codex",
    icon: "IconCode",
    keyPrefix: "sk-",
    keyPlaceholder: "sk-...",
    helpUrl: "https://docs.anthropic.com/en/docs/claude-code/codex",
    helpText: "Get a key from Codex settings",
  },
  {
    id: "minimax",
    name: "MiniMax",
    icon: "IconCloud",
    keyPlaceholder: "mk-...",
    helpUrl: "https://platform.minimax.io/",
    helpText: "Get a key from MiniMax platform",
  },
  {
    id: "moonshot",
    name: "Moonshot",
    icon: "IconCloud",
    keyPlaceholder: "sk-...",
    helpUrl: "https://platform.moonshot.ai",
    helpText: "Get a key from Moonshot platform",
  },
];

export type AgentModelOption = {
  value: string;
  label: string;
  provider: AgentProvider;
};

export type MCPServerConfig =
  | {
      id?: string;
      name?: string;
      type: "stdio";
      command: string;
      args?: string[];
      env?: Record<string, string>;
      cwd?: string;
    }
  | {
      id?: string;
      name?: string;
      type: "http" | "sse";
      url: string;
      headers?: Record<string, string>;
    };

export type MCPServerHealth = {
  name: string;
  type: MCPServerConfig["type"];
  toolNames: string[];
  toolCount: number;
};

export type MCPValidationResult = {
  servers: MCPServerHealth[];
  warnings: string[];
};

export type AgentStartParams = {
  prompt: string;
  workspaceId: string;
  workspacePath?: string;
  activeThreadId?: string;
  existingMessages?: AgentMessage[];
  activeMemory?: string;
  model?: string;
  mode?: AgentMode;
  provider?: AgentProvider;
  requireApproval?: boolean;
  resumeSessionId?: string;
  imageAttachments?: ImageAttachment[];
  mcpServers?: MCPServerConfig[];
};

export type ThreadTitleParams = {
  messages: AgentMessage[];
  model?: string;
  provider?: AgentProvider;
};

export type CommitMessageGeneratorFile = {
  path: string;
  added: number;
  deleted: number;
  patch?: string;
};

export type CommitMessageParams = {
  files: CommitMessageGeneratorFile[];
  model?: string;
  provider?: AgentProvider;
};

export type AgentErrorPayload = {
  sessionId: string;
  error: string;
  workspaceId?: string;
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
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
  activeMemory?: string;
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
  updatedAt: number;
  title?: string;
  sdkSessionId?: string;
  provider?: AgentProvider;
  model?: string;
  checkpoints?: Checkpoint[];
  taskStatus?: TaskStatus;
  inputTokens?: number;
  outputTokens?: number;
  lastRunInputTokens?: number;
  lastRunOutputTokens?: number;
  lastReadAt?: number;
  activeMemory?: string;
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
  patch?: string;
};

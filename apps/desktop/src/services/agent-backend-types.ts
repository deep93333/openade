import type {
  AgentMessage,
  AgentMode,
  AgentResult,
  AgentProvider,
  ImageAttachment,
} from "@agentide/shared";

export type ToolApprovalResult =
  | { behavior: "allow"; updatedInput?: unknown }
  | { behavior: "deny"; message: string };

export type AgentBackendStartOptions = {
  sessionId: string;
  workspacePath: string;
  prompt: string;
  existingMessages?: AgentMessage[];
  model?: string;
  mode?: AgentMode;
  resumeSessionId?: string;
  imageAttachments?: ImageAttachment[];
  abortSignal: AbortSignal;
  canUseTool?: (
    sessionId: string,
    toolName: string,
    input: unknown
  ) => Promise<ToolApprovalResult>;
  onMessage: (message: AgentMessage) => void;
  onResult: (result: AgentResult) => void;
  onError: (payload: { sessionId: string; error: string }) => void;
  onProviderSessionId: (providerSessionId: string) => void;
};

export type ModelOption = {
  value: string;
  label: string;
  provider: AgentProvider;
};

export type ProviderCapabilities = {
  supportedModes: AgentMode[];
  supportsToolApproval: boolean;
  supportsImageAttachments: boolean;
  supportsResume: boolean;
};

export type AgentBackend = {
  readonly provider: AgentProvider;
  readonly capabilities: ProviderCapabilities;
  readonly models: ModelOption[];
  start(options: AgentBackendStartOptions): Promise<void>;
  stop(sessionId: string): Promise<void>;
};

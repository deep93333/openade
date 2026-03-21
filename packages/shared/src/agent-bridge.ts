import type {
  AgentErrorPayload,
  AgentMessage,
  AgentModelOption,
  AgentResult,
  AgentStartParams,
  AgentStatus,
  CommitMessageParams,
  IpcResult,
  SdkSessionIdPayload,
  ThreadTitleParams,
  ToolApprovalRequest,
  ToolApprovalResponse,
} from "./types.js";

export type AgentBridgeApi = {
  start: (params: AgentStartParams) => Promise<IpcResult<{ sessionId: string }>>;
  stop: (sessionId: string) => Promise<IpcResult>;
  status: () => Promise<IpcResult<{ status: AgentStatus; sessionId?: string }>>;
  getModels: () => Promise<IpcResult<AgentModelOption[]>>;
  generateThreadTitle: (params: ThreadTitleParams) => Promise<IpcResult<string | null>>;
  generateCommitMessage: (params: CommitMessageParams) => Promise<IpcResult<string | null>>;
  onMessage: (callback: (message: AgentMessage) => void) => () => void;
  onResult: (callback: (result: AgentResult) => void) => () => void;
  onError: (callback: (payload: AgentErrorPayload) => void) => () => void;
  onSdkSessionId: (callback: (payload: SdkSessionIdPayload) => void) => () => void;
  onToolApprovalRequest: (callback: (request: ToolApprovalRequest) => void) => () => void;
  respondToolApproval: (response: ToolApprovalResponse) => Promise<void>;
};

export type {
  AgentBackend,
  AgentBackendStartOptions,
  ToolApprovalResult,
  ModelOption,
  ProviderCapabilities,
} from "./agent-backend-types.js";
export { createAgentManager } from "./agent-manager.js";
export { createCustomAgentBackend, generateThreadTitle } from "./custom-agent-backend.js";
export type { AgentManagerOptions, AgentManager } from "./agent-manager.js";
export type { AgentBackendConfig } from "./custom-agent-backend.js";
export { buildSystemPrompt, COMPACTION_PROMPT } from "./system-prompt.js";
export { createToolSet, getToolIds, type ToolCallMetadata } from "./tools/registry.js";
export type { ToolContext, ToolResult, ToolDefinition } from "./tools/tool-types.js";

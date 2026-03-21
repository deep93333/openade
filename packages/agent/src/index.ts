// --- Core types ---
export type {
  AgentBackend,
  AgentBackendStartOptions,
  ToolApprovalResult,
  ModelOption,
  ProviderCapabilities,
} from "./types.js";

// --- Agent lifecycle ---
export { createAgentManager } from "./agent-manager.js";
export type { AgentManagerOptions, AgentManager } from "./agent-manager.js";
export { createCustomAgentBackend, generateThreadTitle, generateCommitMessage } from "./agent-runner.js";

// --- Models & pricing ---
export type { AgentBackendConfig, ModelDef, ModelPricing } from "./models.js";
export { refreshModelPricing } from "./models.js";

// --- Logging ---
export { createAgentLogger, logAgentEvent, createFileAgentLogger, formatAgentLogEntry } from "./logger.js";
export type { AgentLogger, AgentLogEntry, AgentLogLevel, AgentLogWriter, FileAgentLoggerOptions } from "./logger.js";

// --- Prompts ---
export { buildSystemPrompt, COMPACTION_PROMPT, ACTIVE_MEMORY_PROMPT } from "./system-prompt.js";

// --- Caching ---
export { addCacheControl } from "./cache.js";

// --- Tools ---
export { createToolSet, createPlanningToolSet, getToolIds, type ToolCallMetadata } from "./tools/registry.js";
export type { ToolContext, ToolResult, ToolDefinition, SubAgentCapability, MCPToolRuntime, ReadCacheEntry } from "./tools/tool-types.js";
export { validateMCPServers } from "./tools/mcp.js";

// --- Sub-agents ---
export type { SubAgentTask, SubAgentResult } from "./sub-agent.js";

// --- Persistence ---
export { appendMessage, appendMessages, loadThread, threadExists, getThreadPath } from "./persistence.js";

// --- Output offloading ---
export {
  initOffloader,
  offloadToolOutput,
  type OffloaderState,
  type OffloadedFile,
} from "./output-offloader.js";

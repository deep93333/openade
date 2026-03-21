import { z } from "zod";
import type { LanguageModel, ToolSet } from "ai";
import type { MCPServerConfig } from "@agentide/shared";
import type { OffloaderState } from "../output-offloader.js";
import type { AgentLogger } from "../logger.js";

export type UserInputResponse = {
  updatedInput?: unknown;
  denied?: boolean;
  message?: string;
};

export type ToolStartMeta = {
  toolName: string;
  input: unknown;
  toolCallId: string;
};

export type MCPToolRuntime = {
  config: MCPServerConfig;
  tools: ToolSet;
  close: () => Promise<void>;
};

export type SubAgentCapability = {
  languageModel: LanguageModel;
  systemPrompt: string;
};

export type ReadCacheEntry = {
  path: string;
  readCount: number;
  lastOffset?: number;
  lastLimit?: number;
  firstReadAt: number;
};

export type ToolContext = {
  sessionId: string;
  workspacePath: string;
  abortSignal: AbortSignal;
  onMetadata: (meta: Record<string, unknown>) => void;
  requestUserInput: (toolName: string, input: unknown) => Promise<UserInputResponse>;
  onToolStart?: (meta: ToolStartMeta) => void;
  subAgent?: SubAgentCapability;
  mcpTools?: MCPToolRuntime[];
  offloader?: OffloaderState;
  readCache?: Map<string, ReadCacheEntry>;
  logger?: AgentLogger;
};

export type ToolResult = {
  title: string;
  output: string;
  metadata: Record<string, unknown>;
};

export type ToolDefinition<T extends z.ZodType = z.ZodType> = {
  id: string;
  description: string;
  parameters: T;
  execute: (args: z.infer<T>, ctx: ToolContext) => Promise<ToolResult>;
};

const MAX_OUTPUT_CHARS = 50_000;
const TRUNCATION_NOTICE =
  "\n\n[Output truncated — showing first portion only. Use offset/limit parameters for paginated reading.]";

export function truncateOutput(output: string, max = MAX_OUTPUT_CHARS): string {
  if (output.length <= max) return output;
  return output.slice(0, max) + TRUNCATION_NOTICE;
}

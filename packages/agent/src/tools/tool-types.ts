import { z } from "zod";
import type { LanguageModel } from "ai";

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

export type SubAgentCapability = {
  languageModel: LanguageModel;
  systemPrompt: string;
};

export type ToolContext = {
  sessionId: string;
  workspacePath: string;
  abortSignal: AbortSignal;
  onMetadata: (meta: Record<string, unknown>) => void;
  requestUserInput: (toolName: string, input: unknown) => Promise<UserInputResponse>;
  onToolStart?: (meta: ToolStartMeta) => void;
  subAgent?: SubAgentCapability;
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

const MAX_OUTPUT_CHARS = 30_000;
const TRUNCATION_NOTICE =
  "\n\n[Output truncated — showing first portion only. Use offset/limit parameters for paginated reading.]";

export function truncateOutput(output: string, max = MAX_OUTPUT_CHARS): string {
  if (output.length <= max) return output;
  return output.slice(0, max) + TRUNCATION_NOTICE;
}

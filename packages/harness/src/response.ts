import type { Runtime } from "./ids.js";

export type UsageInfo = {
  inputTokens?: number;
  outputTokens?: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
};

export type CostInfo = {
  totalUsd?: number;
  perModel?: Record<string, { inputTokens: number; outputTokens: number; costUsd: number }>;
};

export type Segment =
  | { type: "text"; text: string }
  | { type: "tool_call"; tool: string; input: Record<string, unknown>; output?: string }
  | { type: "error"; code: string; message: string };

export type Turn = {
  id: string;
  sessionId: string;
  runtime: Runtime;
  content: Segment[];
  usage?: UsageInfo;
  cost?: CostInfo;
  raw?: unknown;
};

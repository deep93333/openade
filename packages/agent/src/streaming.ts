import type { LanguageModelUsage, ModelMessage } from "ai";
import type { ModelDef } from "./models.js";

const CHARS_PER_TOKEN_ESTIMATE = 4;
const PRUNE_PROTECT_TOKENS = 40_000;
const PRUNE_MIN_SAVINGS = 20_000;

export const RETRY_INITIAL_DELAY = 2000;
export const RETRY_BACKOFF_FACTOR = 2;
export const RETRY_MAX_DELAY = 30_000;
export const RETRY_MAX_ATTEMPTS = 10;

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN_ESTIMATE);
}

export function computeCost(usage: LanguageModelUsage, modelDef: ModelDef): number {
  const inputTokens = usage.inputTokens ?? 0;
  const outputTokens = usage.outputTokens ?? 0;
  const inputRate =
    modelDef.inputPricePer1k ??
    (modelDef.llmProvider === "anthropic" ? 0.003 : modelDef.llmProvider === "minimax" ? 0.0002 : 0.002);
  const outputRate =
    modelDef.outputPricePer1k ??
    (modelDef.llmProvider === "anthropic" ? 0.015 : modelDef.llmProvider === "minimax" ? 0.0008 : 0.010);

  const cacheRead = usage.inputTokenDetails?.cacheReadTokens ?? 0;
  const cacheWrite = usage.inputTokenDetails?.cacheWriteTokens ?? 0;

  if (modelDef.llmProvider === "anthropic" && (cacheRead > 0 || cacheWrite > 0)) {
    const uncachedTokens = inputTokens - cacheRead - cacheWrite;
    const inputCost =
      uncachedTokens * inputRate +
      cacheRead * inputRate * 0.1 +
      cacheWrite * inputRate * 1.25;
    return (inputCost + outputTokens * outputRate) / 1000;
  }

  return (inputTokens * inputRate + outputTokens * outputRate) / 1000;
}

export function parseRetryDelay(error: unknown, attempt: number): number | null {
  const err = error as {
    statusCode?: number;
    isRetryable?: boolean;
    responseHeaders?: Record<string, string>;
  };

  const status = err.statusCode;
  const isRetryable = err.isRetryable === true || status === 429 || status === 503 || status === 529;

  if (!isRetryable) return null;
  if (attempt >= RETRY_MAX_ATTEMPTS) return null;

  const headers = err.responseHeaders;
  if (headers) {
    const retryAfterMs = headers["retry-after-ms"];
    if (retryAfterMs) {
      const ms = parseFloat(retryAfterMs);
      if (!isNaN(ms)) return ms;
    }
    const retryAfter = headers["retry-after"];
    if (retryAfter) {
      const secs = parseFloat(retryAfter);
      if (!isNaN(secs)) return Math.ceil(secs * 1000);
      const date = Date.parse(retryAfter) - Date.now();
      if (!isNaN(date) && date > 0) return Math.ceil(date);
    }
  }

  return Math.min(RETRY_INITIAL_DELAY * Math.pow(RETRY_BACKOFF_FACTOR, attempt - 1), RETRY_MAX_DELAY);
}

export function isContextOverflow(error: unknown): boolean {
  const msg = (error as { message?: string })?.message ?? String(error);
  const patterns = [
    /prompt is too long/i,
    /exceeds the context window/i,
    /input token count.*exceeds the maximum/i,
    /maximum context length/i,
    /context[_ ]length[_ ]exceeded/i,
    /reduce the length of the messages/i,
  ];
  return patterns.some((p) => p.test(msg));
}

export async function abortableSleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    function onAbort() {
      clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
    }
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

export function pruneConversation(messages: ModelMessage[]): ModelMessage[] {
  let totalToolTokens = 0;
  const toolResultIndices: { index: number; tokens: number }[] = [];

  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.role === "tool") {
      const content = typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content);
      const tokens = estimateTokens(content);
      totalToolTokens += tokens;
      toolResultIndices.push({ index: i, tokens });
    }
  }

  if (totalToolTokens <= PRUNE_PROTECT_TOKENS + PRUNE_MIN_SAVINGS) return messages;

  let kept = 0;
  const toPrune = new Set<number>();
  for (const entry of toolResultIndices) {
    kept += entry.tokens;
    if (kept > PRUNE_PROTECT_TOKENS) toPrune.add(entry.index);
  }

  if (toPrune.size === 0) return messages;

  return messages.map((msg, i) => {
    if (!toPrune.has(i)) return msg;
    if (msg.role === "tool" && Array.isArray(msg.content)) {
      const pruned = {
        ...msg,
        content: msg.content.map((part) => {
          if (part && typeof part === "object" && "output" in part) {
            return { ...part, output: { type: "text" as const, value: "[Old tool result content cleared]" } };
          }
          return part;
        }),
      };
      return pruned as unknown as ModelMessage;
    }
    return msg;
  });
}

export function extractApiErrorMessage(error: unknown): string {
  const err = error as {
    message?: string;
    statusCode?: number;
    responseBody?: string;
    data?: { error?: { message?: string; type?: string } };
  };

  if (err.data?.error?.message) {
    const apiMsg = err.data.error.message;
    const type = err.data.error.type ?? "";
    const status = err.statusCode ? ` (${err.statusCode})` : "";
    return `${type}${status}: ${apiMsg}`;
  }

  if (err.responseBody) {
    try {
      const body = JSON.parse(err.responseBody);
      if (body?.error?.message) return `API error (${err.statusCode ?? "unknown"}): ${body.error.message}`;
    } catch {}
  }

  if (err.message && err.message !== "No output generated. Check the stream for errors.") return err.message;
  if (err.statusCode) return `API request failed with status ${err.statusCode}`;
  return error instanceof Error ? error.message : String(error);
}

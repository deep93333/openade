import { ulid } from "ulid";
import {
  streamText,
  stepCountIs,
  type ModelMessage,
  type LanguageModelUsage,
} from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { createMinimax } from "vercel-minimax-ai-provider";
import { createToolSet, createReadOnlyToolSet, type ToolCallMetadata } from "./tools/registry.js";
import { buildSystemPrompt, COMPACTION_PROMPT } from "./system-prompt.js";
import type { AgentMessage, AgentMode, AgentProvider, ThreadTitleParams } from "@agentide/shared";
import type {
  AgentBackend,
  AgentBackendStartOptions,
} from "./agent-backend-types.js";
import type { ToolContext } from "./tools/tool-types.js";

export type AgentBackendConfig = {
  getApiKey: () => string | null;
  getCodexApiKey: () => string | null;
  getMinimaxApiKey: () => string | null;
  writeAgentLog?: (
    level: "INFO" | "WARN" | "ERROR",
    source: string,
    ...args: unknown[]
  ) => void;
};

const TOOL_OUTPUT_LIMIT = 800;
const ASSISTANT_MSG_LIMIT = 2000;
const TITLE_INPUT_LIMIT = 1600;
const TITLE_MAX_LENGTH = 80;
const TITLE_PROMPT =
  "Generate a concise thread title (max 6 words) that summarizes the user's request. Use title case. Return only the title with no quotes or trailing punctuation.";

function cap(text: string, limit: number): string {
  return text.length > limit ? text.slice(0, limit) + "…" : text;
}

function summarizeExistingMessages(messages: AgentMessage[]): ModelMessage[] {
  if (messages.length === 0) return [];

  const lines: string[] = [];

  for (const m of messages) {
    const text = typeof m.content === "string" ? m.content : String(m.content ?? "");
    if (!text.trim() || m.isPartial) continue;

    switch (m.role) {
      case "user":
        lines.push(`[User]: ${text}`);
        break;
      case "assistant":
        lines.push(`[Assistant]: ${cap(text, ASSISTANT_MSG_LIMIT)}`);
        break;
      case "tool": {
        const name = m.toolName ?? "tool";
        lines.push(`[${name}]: ${cap(text, TOOL_OUTPUT_LIMIT)}`);
        break;
      }
      case "system":
        lines.push(`[System]: ${text}`);
        break;
    }
  }

  if (lines.length === 0) return [];

  return [
    {
      role: "user",
      content: [{ type: "text" as const, text: `Previous conversation in this thread:\n\n${lines.join("\n\n")}\n\nContinue from where we left off.` }],
    } as ModelMessage,
    {
      role: "assistant",
      content: "Understood, continuing.",
    } as ModelMessage,
  ];
}

function buildTitleContext(messages: AgentMessage[]): string | null {
  const firstUser = messages.find((m) => m.role === "user" && m.content.trim());
  if (!firstUser) return null;
  const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant" && m.content.trim());
  const parts = [`User: ${cap(firstUser.content, TITLE_INPUT_LIMIT)}`];
  if (lastAssistant) {
    parts.push(`Assistant: ${cap(lastAssistant.content, TITLE_INPUT_LIMIT)}`);
  }
  return parts.join("\n");
}

function cleanTitle(raw: string): string {
  const firstLine = raw.split("\n")[0] ?? "";
  const trimmed = firstLine.trim().replace(/^["'“”]+|["'“”]+$/g, "");
  const collapsed = trimmed.replace(/\s+/g, " ");
  const noTrailingPunctuation = collapsed.replace(/[.:;!?]+$/g, "");
  if (noTrailingPunctuation.length <= TITLE_MAX_LENGTH) return noTrailingPunctuation;
  return noTrailingPunctuation.slice(0, TITLE_MAX_LENGTH).trimEnd();
}

type LlmProvider = "anthropic" | "openai" | "minimax";

type ModelDef = {
  value: string;
  label: string;
  llmProvider: LlmProvider;
  apiModelId: string;
  uiProvider: AgentProvider;
  inputPricePer1k?: number;
  outputPricePer1k?: number;
};

const MODELS: ModelDef[] = [
  { value: "claude-sonnet-4-6", label: "Claude Sonnet 4.6", llmProvider: "anthropic", apiModelId: "claude-sonnet-4-6", uiProvider: "claude" },
  { value: "claude-opus-4-6", label: "Claude Opus 4.6", llmProvider: "anthropic", apiModelId: "claude-opus-4-6", uiProvider: "claude" },
  { value: "claude-haiku-4-5", label: "Claude Haiku 4.5", llmProvider: "anthropic", apiModelId: "claude-haiku-4-5-20251001", uiProvider: "claude" },
  {
    value: "gpt-5.2",
    label: "GPT-5.2",
    llmProvider: "openai",
    apiModelId: "gpt-5.2",
    uiProvider: "codex",
    inputPricePer1k: 1.75 / 1000,
    outputPricePer1k: 14 / 1000,
  },
  {
    value: "gpt-5-mini",
    label: "GPT-5 Mini",
    llmProvider: "openai",
    apiModelId: "gpt-5-mini",
    uiProvider: "codex",
    inputPricePer1k: 0.25 / 1000,
    outputPricePer1k: 2 / 1000,
  },
  {
    value: "gpt-5.2-codex",
    label: "GPT-5.2 Codex",
    llmProvider: "openai",
    apiModelId: "gpt-5.2-codex",
    uiProvider: "codex",
    inputPricePer1k: 1.75 / 1000,
    outputPricePer1k: 14 / 1000,
  },
  {
    value: "gpt-5.3-codex",
    label: "GPT-5.3 Codex",
    llmProvider: "openai",
    apiModelId: "gpt-5.3-codex",
    uiProvider: "codex",
    inputPricePer1k: 1.75 / 1000,
    outputPricePer1k: 14 / 1000,
  },
  {
    value: "gpt-5.1-codex-mini",
    label: "GPT-5.1 Codex Mini",
    llmProvider: "openai",
    apiModelId: "gpt-5.1-codex-mini",
    uiProvider: "codex",
    inputPricePer1k: 0.25 / 1000,
    outputPricePer1k: 2 / 1000,
  },
  {
    value: "minimax-m2",
    label: "MiniMax M2",
    llmProvider: "minimax",
    apiModelId: "MiniMax-M2",
    uiProvider: "minimax",
  },
  {
    value: "minimax-m2.1",
    label: "MiniMax M2.1",
    llmProvider: "minimax",
    apiModelId: "MiniMax-M2.1",
    uiProvider: "minimax",
  },
  {
    value: "minimax-m2.1-lightning",
    label: "MiniMax M2.1 Lightning",
    llmProvider: "minimax",
    apiModelId: "MiniMax-M2.1-lightning",
    uiProvider: "minimax",
  },
  {
    value: "minimax-m2.5",
    label: "MiniMax M2.5",
    llmProvider: "minimax",
    apiModelId: "MiniMax-M2.5",
    uiProvider: "minimax",
  },
];

const RETRY_INITIAL_DELAY = 2000;
const RETRY_BACKOFF_FACTOR = 2;
const RETRY_MAX_DELAY = 30_000;
const RETRY_MAX_ATTEMPTS = 10;
const MAX_TOOL_STEPS = 75;

const PRUNE_PROTECT_TOKENS = 40_000;
const PRUNE_MIN_SAVINGS = 20_000;
const CHARS_PER_TOKEN_ESTIMATE = 4;

const activeSessions = new Map<string, AbortController>();

function resolveModel(modelValue: string | undefined): ModelDef {
  if (!modelValue) return MODELS[0];
  return MODELS.find((m) => m.value === modelValue) ?? MODELS[0];
}

function resolveModelForProvider(modelValue: string | undefined, provider: AgentProvider | undefined): ModelDef {
  if (modelValue) return resolveModel(modelValue);
  if (provider) {
    return MODELS.find((m) => m.uiProvider === provider) ?? MODELS[0];
  }
  return MODELS[0];
}

function getProviderApiKey(provider: LlmProvider, config: AgentBackendConfig): string {
  if (provider === "anthropic") {
    const key = config.getApiKey();
    if (!key) throw new Error("Anthropic API key not set. Configure it in Settings → Authentication.");
    return key;
  }
  if (provider === "minimax") {
    const key = config.getMinimaxApiKey();
    if (!key) throw new Error("MiniMax API key not set. Configure it in Settings → Authentication.");
    return key;
  }
  const key = config.getCodexApiKey();
  if (!key) throw new Error("OpenAI API key not set. Configure it in Settings → Authentication (Codex).");
  return key;
}

function createLanguageModel(modelDef: ModelDef, config: AgentBackendConfig) {
  const apiKey = getProviderApiKey(modelDef.llmProvider, config);
  if (modelDef.llmProvider === "anthropic") {
    const anthropic = createAnthropic({ apiKey });
    return anthropic(modelDef.apiModelId);
  }
  if (modelDef.llmProvider === "minimax") {
    const minimax = createMinimax({ apiKey });
    return minimax(modelDef.apiModelId);
  }
  const openai = createOpenAI({ apiKey });
  return openai(modelDef.apiModelId);
}

export async function generateThreadTitle(
  config: AgentBackendConfig,
  params: ThreadTitleParams,
): Promise<string | null> {
  const context = buildTitleContext(params.messages ?? []);
  if (!context) return null;

  const modelDef = resolveModelForProvider(params.model, params.provider);
  const languageModel = createLanguageModel(modelDef, config);
  const result = streamText({
    model: languageModel,
    messages: [
      { role: "system", content: TITLE_PROMPT } as ModelMessage,
      { role: "user", content: context } as ModelMessage,
    ],
    maxOutputTokens: 40,
    temperature: 0.2,
  });

  const rawTitle = await result.text;
  if (!rawTitle) return null;
  const cleaned = cleanTitle(rawTitle);
  return cleaned.length > 0 ? cleaned : null;
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN_ESTIMATE);
}

function computeCost(usage: LanguageModelUsage, modelDef: ModelDef): number {
  const inputTokens = usage.inputTokens ?? 0;
  const outputTokens = usage.outputTokens ?? 0;
  const inputRate =
    modelDef.inputPricePer1k ??
    (modelDef.llmProvider === "anthropic" ? 0.003 : modelDef.llmProvider === "minimax" ? 0.0002 : 0.002);
  const outputRate =
    modelDef.outputPricePer1k ??
    (modelDef.llmProvider === "anthropic" ? 0.015 : modelDef.llmProvider === "minimax" ? 0.0008 : 0.010);
  return (inputTokens * inputRate + outputTokens * outputRate) / 1000;
}

function parseRetryDelay(error: unknown, attempt: number): number | null {
  const err = error as {
    statusCode?: number;
    isRetryable?: boolean;
    responseHeaders?: Record<string, string>;
  };

  const status = err.statusCode;
  const isRetryable =
    err.isRetryable === true ||
    status === 429 ||
    status === 503 ||
    status === 529;

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

  return Math.min(
    RETRY_INITIAL_DELAY * Math.pow(RETRY_BACKOFF_FACTOR, attempt - 1),
    RETRY_MAX_DELAY,
  );
}

function isContextOverflow(error: unknown): boolean {
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

async function abortableSleep(ms: number, signal: AbortSignal): Promise<void> {
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

function pruneConversation(messages: ModelMessage[]): ModelMessage[] {
  let totalToolTokens = 0;
  const toolResultIndices: { index: number; tokens: number }[] = [];

  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.role === "tool") {
      const content = typeof msg.content === "string"
        ? msg.content
        : JSON.stringify(msg.content);
      const tokens = estimateTokens(content);
      totalToolTokens += tokens;
      toolResultIndices.push({ index: i, tokens });
    }
  }

  if (totalToolTokens <= PRUNE_PROTECT_TOKENS + PRUNE_MIN_SAVINGS) {
    return messages;
  }

  let kept = 0;
  const toPrune = new Set<number>();
  for (const entry of toolResultIndices) {
    kept += entry.tokens;
    if (kept > PRUNE_PROTECT_TOKENS) {
      toPrune.add(entry.index);
    }
  }

  if (toPrune.size === 0) return messages;

  return messages.map((msg, i) => {
    if (!toPrune.has(i)) return msg;
    if (msg.role === "tool" && Array.isArray(msg.content)) {
      const pruned = {
        ...msg,
        content: msg.content.map((part) => {
          if (part && typeof part === "object" && "output" in part) {
            return {
              ...part,
              output: { type: "text" as const, value: "[Old tool result content cleared]" },
            };
          }
          return part;
        }),
      };
      return pruned as unknown as ModelMessage;
    }
    return msg;
  });
}

function extractApiErrorMessage(error: unknown): string {
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
      if (body?.error?.message) {
        return `API error (${err.statusCode ?? "unknown"}): ${body.error.message}`;
      }
    } catch {}
  }

  if (err.message && err.message !== "No output generated. Check the stream for errors.") {
    return err.message;
  }

  if (err.statusCode) {
    return `API request failed with status ${err.statusCode}`;
  }

  return error instanceof Error ? error.message : String(error);
}

function noopLog(
  _level: "INFO" | "WARN" | "ERROR",
  _source: string,
  ..._args: unknown[]
): void {}

async function runAgent(
  config: AgentBackendConfig,
  options: AgentBackendStartOptions,
): Promise<void> {
  const writeAgentLog = config.writeAgentLog ?? noopLog;
  const sessionId = options.sessionId;
  const modelDef = resolveModel(options.model);

  writeAgentLog("INFO", "Agent", "runAgent start", {
    sessionId,
    model: modelDef.value,
    llmProvider: modelDef.llmProvider,
    workspacePath: options.workspacePath,
  });

  const mode: AgentMode = options.mode ?? "agent";
  const languageModel = createLanguageModel(modelDef, config);
  const systemPrompt = await buildSystemPrompt(options.workspacePath, mode);

  const abortController = new AbortController();
  activeSessions.set(sessionId, abortController);

  const linkedAbort = new AbortController();
  const onExternalAbort = () => linkedAbort.abort();
  options.abortSignal.addEventListener("abort", onExternalAbort, { once: true });
  abortController.signal.addEventListener("abort", () => linkedAbort.abort(), { once: true });

  let totalCostUsd = 0;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  const conversationHistory: ModelMessage[] = options.existingMessages?.length
    ? summarizeExistingMessages(options.existingMessages)
    : [];

  const userContent: Array<{ type: "text"; text: string } | { type: "image"; image: string; mimeType?: string }> = [];
  userContent.push({ type: "text", text: options.prompt });

  if (options.imageAttachments?.length) {
    for (const img of options.imageAttachments) {
      const match = img.dataUrl.match(/^data:([^;]+);base64,(.+)$/);
      if (match) {
        userContent.push({
          type: "image",
          image: match[2],
          mimeType: match[1],
        });
      }
    }
  }

  conversationHistory.push({ role: "user", content: userContent } as ModelMessage);

  if (mode === "ask" || mode === "plan") {
    const isAsk = mode === "ask";
    const toolCtxReadOnly: ToolContext = {
      sessionId,
      workspacePath: options.workspacePath,
      abortSignal: linkedAbort.signal,
      onMetadata: () => {},
      requestUserInput: async () => ({ denied: false, updatedInput: undefined }),
      onToolStart: (meta) => {
        options.onMessage({
          id: meta.toolCallId,
          role: "tool",
          content: "",
          toolName: meta.toolName,
          toolInput: meta.input,
          toolStatus: "running",
          timestamp: Date.now(),
          sessionId,
          toolCallId: meta.toolCallId,
        });
      },
    };

    const readOnlyToolCallHandler = (meta: ToolCallMetadata) => {
      options.onMessage({
        id: meta.toolCallId,
        role: "tool",
        content: typeof meta.output === "string" ? meta.output : JSON.stringify(meta.output),
        toolName: meta.toolName,
        toolInput: meta.input,
        toolResult: meta.metadata,
        toolStatus: "completed",
        timestamp: Date.now(),
        sessionId,
        toolCallId: meta.toolCallId,
      });
    };

    const readOnlyToolSet = createReadOnlyToolSet(toolCtxReadOnly, readOnlyToolCallHandler);
    const READ_ONLY_MAX_STEPS = 20;
    let attempt = 0;
    let lastFinalText = "";

    while (!linkedAbort.signal.aborted) {
      try {
        const prunedHistory = pruneConversation(conversationHistory);
        let currentStreamedText = "";

        const result = streamText({
          model: languageModel,
          system: systemPrompt,
          messages: prunedHistory,
          tools: readOnlyToolSet,
          stopWhen: stepCountIs(READ_ONLY_MAX_STEPS),
          abortSignal: linkedAbort.signal,
          onError: ({ error }) => {
            const err = error as { message?: string; statusCode?: number; responseBody?: string; data?: unknown };
            writeAgentLog("ERROR", "Agent", "stream error", {
              sessionId,
              message: err.message ?? String(error),
              statusCode: err.statusCode,
            });
          },
        });

        for await (const textDelta of result.textStream) {
          if (linkedAbort.signal.aborted) break;
          currentStreamedText += textDelta;
          options.onMessage({
            id: ulid(),
            role: "assistant",
            content: currentStreamedText,
            isPartial: true,
            timestamp: Date.now(),
            sessionId,
            agentMode: mode,
          });
        }

        const finalText = await result.text;
        const finishReason = await result.finishReason;
        const response = await result.response;

        const totalUsage = await result.totalUsage;
        if (totalUsage) {
          totalInputTokens += totalUsage.inputTokens ?? 0;
          totalOutputTokens += totalUsage.outputTokens ?? 0;
          totalCostUsd += computeCost(totalUsage, modelDef);
        }

        if (finalText) {
          lastFinalText = finalText;
          options.onMessage({
            id: ulid(),
            role: "assistant",
            content: finalText,
            isPartial: false,
            timestamp: Date.now(),
            sessionId,
            agentMode: mode,
            ...(!isAsk ? { planContent: finalText } : {}),
          });
        }

        for (const msg of response.messages) {
          conversationHistory.push(msg as ModelMessage);
        }

        attempt = 0;

        if (finishReason !== "tool-calls") {
          writeAgentLog("INFO", "Agent", `${mode} finished`, { sessionId, reason: finishReason });
          break;
        }
      } catch (error: unknown) {
        if (linkedAbort.signal.aborted) {
          writeAgentLog("INFO", "Agent", `${mode} aborted`, { sessionId });
          break;
        }

        const message = extractApiErrorMessage(error);
        writeAgentLog("ERROR", "Agent", `${mode} loop error`, { sessionId, message });

        attempt++;
        const delay = parseRetryDelay(error, attempt);
        if (delay !== null) {
          writeAgentLog("INFO", "Agent", "retrying", { sessionId, attempt, delayMs: delay });
          options.onMessage({
            id: ulid(),
            role: "system",
            content: `Rate limited — retrying in ${Math.ceil(delay / 1000)}s (attempt ${attempt}/${RETRY_MAX_ATTEMPTS})...`,
            timestamp: Date.now(),
            sessionId,
          });
          try {
            await abortableSleep(delay, linkedAbort.signal);
          } catch {
            break;
          }
          continue;
        }

        options.onError({ sessionId, error: message });
        break;
      }
    }

    if (!isAsk && !lastFinalText && !linkedAbort.signal.aborted) {
      const lastAssistant = conversationHistory.filter((m) => m.role === "assistant").pop();
      if (lastAssistant) {
        const content = typeof lastAssistant.content === "string"
          ? lastAssistant.content
          : JSON.stringify(lastAssistant.content);
        if (content) {
          options.onMessage({
            id: ulid(),
            role: "assistant",
            content,
            isPartial: false,
            timestamp: Date.now(),
            sessionId,
            agentMode: mode,
            planContent: content,
          });
        }
      }
    }
  } else {
    const toolCtx: ToolContext = {
      sessionId,
      workspacePath: options.workspacePath,
      abortSignal: linkedAbort.signal,
      onMetadata: () => {},
      requestUserInput: async (toolName: string, input: unknown) => {
        if (!options.canUseTool) return { denied: false, updatedInput: input };
        const result = await options.canUseTool(sessionId, toolName, input);
        if (result.behavior === "deny") return { denied: true, message: result.message };
        return { denied: false, updatedInput: result.updatedInput };
      },
      onToolStart: (meta) => {
        options.onMessage({
          id: meta.toolCallId,
          role: "tool",
          content: "",
          toolName: meta.toolName,
          toolInput: meta.input,
          toolStatus: "running",
          timestamp: Date.now(),
          sessionId,
          toolCallId: meta.toolCallId,
        });
      },
    };

    const toolCallHandler = (meta: ToolCallMetadata) => {
      options.onMessage({
        id: meta.toolCallId,
        role: "tool",
        content: typeof meta.output === "string" ? meta.output : JSON.stringify(meta.output),
        toolName: meta.toolName,
        toolInput: meta.input,
        toolResult: meta.metadata,
        toolStatus: "completed",
        timestamp: Date.now(),
        sessionId,
        toolCallId: meta.toolCallId,
      });
    };

    const toolSet = createToolSet(toolCtx, toolCallHandler);

    let attempt = 0;

    while (!linkedAbort.signal.aborted) {
      try {
        const prunedHistory = pruneConversation(conversationHistory);
        let currentStreamedText = "";

        const result = streamText({
          model: languageModel,
          system: systemPrompt,
          messages: prunedHistory,
          tools: toolSet,
          stopWhen: stepCountIs(MAX_TOOL_STEPS),
          abortSignal: linkedAbort.signal,
          onError: ({ error }) => {
            const err = error as { message?: string; statusCode?: number; responseBody?: string; data?: unknown };
            writeAgentLog("ERROR", "Agent", "stream error", {
              sessionId,
              message: err.message ?? String(error),
              statusCode: err.statusCode,
              responseBody: err.responseBody ? (err.responseBody.length > 500 ? err.responseBody.slice(0, 500) + "…" : err.responseBody) : undefined,
              data: err.data,
            });
          },
        });

        for await (const textDelta of result.textStream) {
          if (linkedAbort.signal.aborted) break;
          currentStreamedText += textDelta;
          options.onMessage({
            id: ulid(),
            role: "assistant",
            content: currentStreamedText,
            isPartial: true,
            timestamp: Date.now(),
            sessionId,
          });
        }

        const finalText = await result.text;
        const finishReason = await result.finishReason;
        const response = await result.response;

        const totalUsage = await result.totalUsage;
        if (totalUsage) {
          const callInput = totalUsage.inputTokens ?? 0;
          const callOutput = totalUsage.outputTokens ?? 0;
          totalInputTokens += callInput;
          totalOutputTokens += callOutput;
          totalCostUsd += computeCost(totalUsage, modelDef);
        }

        if (finalText) {
          options.onMessage({
            id: ulid(),
            role: "assistant",
            content: finalText,
            isPartial: false,
            timestamp: Date.now(),
            sessionId,
          });
        }

        for (const msg of response.messages) {
          conversationHistory.push(msg as ModelMessage);
        }

        attempt = 0;

        if (finishReason !== "tool-calls") {
          writeAgentLog("INFO", "Agent", "agent finished", { sessionId, reason: finishReason });
          break;
        }

      } catch (error: unknown) {
        if (linkedAbort.signal.aborted) {
          writeAgentLog("INFO", "Agent", "agent aborted", { sessionId });
          break;
        }

        const message = extractApiErrorMessage(error);
        const err = error as { message?: string; statusCode?: number; responseBody?: string; data?: unknown; stack?: string };
        let dataStr: string | undefined;
        if (err.data != null) {
          try {
            dataStr = JSON.stringify(err.data).slice(0, 500);
          } catch {
            dataStr = String(err.data).slice(0, 500);
          }
        }
        writeAgentLog("ERROR", "Agent", "agent loop error", {
          sessionId,
          message,
          statusCode: err.statusCode,
          responseBody: err.responseBody ? (err.responseBody.length > 1000 ? err.responseBody.slice(0, 1000) + "…" : err.responseBody) : undefined,
          data: dataStr,
          stack: err.stack?.slice(0, 800),
        });

        if (isContextOverflow(error)) {
          writeAgentLog("INFO", "Agent", "context overflow, attempting compaction", { sessionId });
          const compacted = await compactConversation(conversationHistory, modelDef, config, linkedAbort.signal);
          if (compacted) {
            conversationHistory.length = 0;
            conversationHistory.push(...compacted);
            options.onMessage({
              id: ulid(),
              role: "system",
              content: "Context was too long — conversation has been summarized to continue.",
              timestamp: Date.now(),
              sessionId,
            });
            continue;
          }
          options.onError({ sessionId, error: "Context overflow and compaction failed: " + message });
          break;
        }

        attempt++;
        const delay = parseRetryDelay(error, attempt);
        if (delay !== null) {
          writeAgentLog("INFO", "Agent", "retrying", { sessionId, attempt, delayMs: delay });
          options.onMessage({
            id: ulid(),
            role: "system",
            content: `Rate limited — retrying in ${Math.ceil(delay / 1000)}s (attempt ${attempt}/${RETRY_MAX_ATTEMPTS})...`,
            timestamp: Date.now(),
            sessionId,
          });
          try {
            await abortableSleep(delay, linkedAbort.signal);
          } catch {
            break;
          }
          continue;
        }

        options.onError({ sessionId, error: message });
        break;
      }
    }
  }

  options.abortSignal.removeEventListener("abort", onExternalAbort);
  activeSessions.delete(sessionId);

  writeAgentLog("INFO", "Agent", "session result", {
    sessionId,
    totalCostUsd,
    inputTokens: totalInputTokens,
    outputTokens: totalOutputTokens,
  });

  options.onResult({
    sessionId,
    success: true,
    totalCostUsd,
    inputTokens: totalInputTokens,
    outputTokens: totalOutputTokens,
  });
}

async function compactConversation(
  messages: ModelMessage[],
  modelDef: ModelDef,
  config: AgentBackendConfig,
  signal: AbortSignal,
): Promise<ModelMessage[] | null> {
  const writeAgentLog = config.writeAgentLog ?? noopLog;
  try {
    const languageModel = createLanguageModel(modelDef, config);
    const compactionMessages: ModelMessage[] = [
      ...messages,
      { role: "user", content: COMPACTION_PROMPT } as ModelMessage,
    ];

    const result = streamText({
      model: languageModel,
      messages: compactionMessages,
      abortSignal: signal,
    });

    const summary = await result.text;
    if (!summary) return null;

    return [
      { role: "assistant", content: summary } as ModelMessage,
      {
        role: "user",
        content: "Continue with the task. The above is a summary of our previous conversation.",
      } as ModelMessage,
    ];
  } catch (err: unknown) {
    writeAgentLog("ERROR", "Agent", "compaction failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

const capabilities = {
  supportedModes: ["agent", "plan", "ask"] as const,
  supportsToolApproval: true,
  supportsImageAttachments: true,
  supportsResume: false,
};

export function createCustomAgentBackend(config: AgentBackendConfig): AgentBackend {
  return {
    provider: "claude",
    capabilities: {
      supportedModes: [...capabilities.supportedModes],
      supportsToolApproval: capabilities.supportsToolApproval,
      supportsImageAttachments: capabilities.supportsImageAttachments,
      supportsResume: capabilities.supportsResume,
    },
    models: MODELS.map((m) => ({
      value: m.value,
      label: m.label,
      provider: m.uiProvider,
    })),
    async start(options) {
      await runAgent(config, options);
    },
    async stop(sessionId) {
      const controller = activeSessions.get(sessionId);
      if (controller) {
        controller.abort();
        activeSessions.delete(sessionId);
      }
    },
  };
}

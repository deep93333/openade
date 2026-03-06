import { ulid } from "ulid";
import {
  streamText,
  stepCountIs,
  type ModelMessage,
  type ToolSet,
} from "ai";
import { createToolSet, createReadOnlyToolSet, createPlanningToolSet, type ToolCallMetadata } from "./tools/registry.js";
import { closeMCPToolRuntimes, createMCPToolRuntimes } from "./tools/mcp.js";
import { buildSystemPrompt, COMPACTION_PROMPT } from "./system-prompt.js";
import {
  MODELS,
  resolveModel,
  resolveModelForProvider,
  createLanguageModel,
  type ModelDef,
  type AgentBackendConfig,
} from "./models.js";
import { addCacheControl } from "./cache.js";
import {
  computeCost,
  parseRetryDelay,
  isContextOverflow,
  abortableSleep,
  pruneConversation,
  extractApiErrorMessage,
  RETRY_MAX_ATTEMPTS,
} from "./streaming.js";
import type { AgentMessage, AgentMode, AgentProvider, ThreadTitleParams } from "@agentide/shared";
import type {
  AgentBackend,
  AgentBackendStartOptions,
} from "./agent-backend-types.js";
import type { ToolContext } from "./tools/tool-types.js";

export type { AgentBackendConfig } from "./models.js";

const TOOL_OUTPUT_LIMIT = 800;
const ASSISTANT_MSG_LIMIT = 2000;
const TITLE_INPUT_LIMIT = 1600;
const TITLE_MAX_LENGTH = 80;
const TITLE_PROMPT =
  "Generate a concise thread title (max 6 words) that summarizes the user's request or what the agent is doing. Use title case. If tool context is provided, consider what the tool is doing (e.g., 'Reading files', 'Running tests', 'Editing code'). Return only the title with no quotes or trailing punctuation.";

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
  const toolMessage = messages.find((m) => m.role === "tool" && m.toolName);

  const parts = [`User: ${cap(firstUser.content, TITLE_INPUT_LIMIT)}`];
  if (lastAssistant) {
    parts.push(`Assistant: ${cap(lastAssistant.content, TITLE_INPUT_LIMIT)}`);
  }
  if (toolMessage?.toolName) {
    parts.push(`Tool: ${toolMessage.toolName}`);
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

const MAX_TOOL_STEPS = 75;

const activeSessions = new Map<string, AbortController>();

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

import { createAgentLogger, logAgentEvent } from "./logger.js";

async function runAgent(
  config: AgentBackendConfig,
  options: AgentBackendStartOptions,
): Promise<void> {
  const logger = createAgentLogger(config.logger);
  const sessionId = options.sessionId;
  const modelDef = resolveModel(options.model);

  logAgentEvent(logger, "INFO", "Agent", "runAgent start", {
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
  let totalCacheReadTokens = 0;
  let totalCacheWriteTokens = 0;
  const mcpRuntimes = await createMCPToolRuntimes(options.mcpServers);

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

  try {
    if (mode === "ask" || mode === "plan" || mode === "agent_review") {
      const isAsk = mode === "ask" || mode === "agent_review";
      const toolCtxReadOnly: ToolContext = {
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
        mcpTools: mcpRuntimes,
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

    const readOnlyToolSet = mode === "plan"
      ? createPlanningToolSet(toolCtxReadOnly, readOnlyToolCallHandler)
      : createReadOnlyToolSet(toolCtxReadOnly, readOnlyToolCallHandler);
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
          prepareStep: ({ messages, model }) => ({
            messages: addCacheControl({ messages, model }),
          }),
          onError: ({ error }) => {
            const err = error as { message?: string; statusCode?: number; responseBody?: string; data?: unknown };
            const message = extractApiErrorMessage(error);
            logAgentEvent(logger, "ERROR", "Agent", "stream error", {
              sessionId,
              message: err.message ?? String(error),
              statusCode: err.statusCode,
            });
            options.onError({ sessionId, error: message });
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
          totalCacheReadTokens += totalUsage.inputTokenDetails?.cacheReadTokens ?? 0;
          totalCacheWriteTokens += totalUsage.inputTokenDetails?.cacheWriteTokens ?? 0;
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
            ...(mode === "agent_review" ? { reviewContent: finalText } : {}),
          });
        }

        for (const msg of response.messages) {
          conversationHistory.push(msg as ModelMessage);
        }

        attempt = 0;

        if (finishReason !== "tool-calls") {
          logAgentEvent(logger, "INFO", "Agent", `${mode} finished`, { sessionId, reason: finishReason });
          break;
        }
      } catch (error: unknown) {
        if (linkedAbort.signal.aborted) {
          logAgentEvent(logger, "INFO", "Agent", `${mode} aborted`, { sessionId });
          break;
        }

        const message = extractApiErrorMessage(error);
        logAgentEvent(logger, "ERROR", "Agent", `${mode} loop error`, { sessionId, message });

        attempt++;
        const delay = parseRetryDelay(error, attempt);
        if (delay !== null) {
          logAgentEvent(logger, "INFO", "Agent", "retrying", { sessionId, attempt, delayMs: delay });
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
      subAgent: {
        languageModel,
        systemPrompt,
      },
      mcpTools: mcpRuntimes,
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
          prepareStep: ({ messages, model }) => ({
            messages: addCacheControl({ messages, model }),
          }),
          onError: ({ error }) => {
            const err = error as { message?: string; statusCode?: number; responseBody?: string; data?: unknown };
            const message = extractApiErrorMessage(error);
            logAgentEvent(logger, "ERROR", "Agent", "stream error", {
              sessionId,
              message: err.message ?? String(error),
              statusCode: err.statusCode,
              responseBody: err.responseBody ? (err.responseBody.length > 500 ? err.responseBody.slice(0, 500) + "…" : err.responseBody) : undefined,
              data: err.data,
            });
            options.onError({ sessionId, error: message });
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
          totalCacheReadTokens += totalUsage.inputTokenDetails?.cacheReadTokens ?? 0;
          totalCacheWriteTokens += totalUsage.inputTokenDetails?.cacheWriteTokens ?? 0;
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
          logAgentEvent(logger, "INFO", "Agent", "agent finished", { sessionId, reason: finishReason });
          break;
        }

      } catch (error: unknown) {
        if (linkedAbort.signal.aborted) {
          logAgentEvent(logger, "INFO", "Agent", "agent aborted", { sessionId });
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
        logAgentEvent(logger, "ERROR", "Agent", "agent loop error", {
          sessionId,
          message,
          statusCode: err.statusCode,
          responseBody: err.responseBody ? (err.responseBody.length > 1000 ? err.responseBody.slice(0, 1000) + "…" : err.responseBody) : undefined,
          data: dataStr,
          stack: err.stack?.slice(0, 800),
        });

        if (isContextOverflow(error)) {
          logAgentEvent(logger, "INFO", "Agent", "context overflow, attempting compaction", { sessionId });
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
          logAgentEvent(logger, "INFO", "Agent", "retrying", { sessionId, attempt, delayMs: delay });
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
  } finally {
    options.abortSignal.removeEventListener("abort", onExternalAbort);
    activeSessions.delete(sessionId);
    await closeMCPToolRuntimes(mcpRuntimes);
  }

  logAgentEvent(logger, "INFO", "Agent", "session result", {
    sessionId,
    totalCostUsd,
    inputTokens: totalInputTokens,
    outputTokens: totalOutputTokens,
    cacheReadTokens: totalCacheReadTokens,
    cacheWriteTokens: totalCacheWriteTokens,
  });

  options.onResult({
    sessionId,
    success: true,
    totalCostUsd,
    inputTokens: totalInputTokens,
    outputTokens: totalOutputTokens,
    cacheReadTokens: totalCacheReadTokens,
    cacheWriteTokens: totalCacheWriteTokens,
  });
}

async function compactConversation(
  messages: ModelMessage[],
  modelDef: ModelDef,
  config: AgentBackendConfig,
  signal: AbortSignal,
): Promise<ModelMessage[] | null> {
  const logger = createAgentLogger(config.logger);
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
    logAgentEvent(logger, "ERROR", "Agent", "compaction failed", {
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

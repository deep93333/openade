import { ulid } from "ulid";
import {
  streamText,
  stepCountIs,
  type ModelMessage,
  type LanguageModelUsage,
} from "ai";
import { createToolSet, createReadOnlyToolSet, createPlanningToolSet, type ToolCallMetadata } from "./tools/registry.js";
import { closeMCPToolRuntimes, createMCPToolRuntimes } from "./tools/mcp.js";
import { buildSystemPrompt, COMPACTION_PROMPT, ACTIVE_MEMORY_PROMPT } from "./system-prompt.js";
import {
  MODELS,
  resolveModel,
  resolveModelForProvider,
  createLanguageModel,
  getCheapModel,
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
  estimateConversationTokens,
  RETRY_MAX_ATTEMPTS,
} from "./token-utils.js";
import type { AgentMessage, AgentMode, CommitMessageParams, ThreadTitleParams } from "@openade/shared";
import { createAgentLogger, logAgentEvent } from "./logger.js";
import { initOffloader } from "./output-offloader.js";
import type {
  AgentBackend,
  AgentBackendStartOptions,
} from "./types.js";
import type { ToolContext } from "./tools/tool-types.js";
import { appendMessages } from "./persistence.js";

export type { AgentBackendConfig } from "./models.js";

const TOOL_OUTPUT_LIMIT = 800;
const ASSISTANT_MSG_LIMIT = 2000;
const TITLE_INPUT_LIMIT = 1600;
const PROACTIVE_COMPACTION_RATIO = 0.70;
const COMPACTION_KEEP_RECENT_TOKENS = 30_000;
const TITLE_MAX_LENGTH = 80;
const COMMIT_MESSAGE_MAX_LENGTH = 72;
const COMMIT_MESSAGE_PATCH_LIMIT = 1200;
const COMMIT_MESSAGE_TOTAL_PATCH_LIMIT = 4000;
const COMMIT_MESSAGE_FILE_LIMIT = 12;
const TITLE_PROMPT =
  "Generate a concise thread title (max 6 words) that summarizes the user's request or what the agent is doing. Use title case. If tool context is provided, consider what the tool is doing (e.g., 'Reading files', 'Running tests', 'Editing code'). Return only the title with no quotes or trailing punctuation.";
const COMMIT_MESSAGE_PROMPT =
  "Generate one short git commit message that summarizes the staged changes. Return only the commit message, no quotes, no bullets, no explanation. Keep it under 72 characters. Prefer an imperative style like 'Add', 'Fix', 'Refactor', 'Update', or 'Remove'. Focus on the main user-visible or structural change, not low-level patch details.";

function cap(text: string, limit: number): string {
  return text.length > limit ? text.slice(0, limit) + "…" : text;
}

function buildContextSeed(activeMemory: string | undefined, messages: AgentMessage[]): ModelMessage[] {
  if (activeMemory?.trim()) {
    return [
      {
        role: "user",
        content: [{ type: "text" as const, text: `Active session memory from previous runs:\n\n${activeMemory}\n\nContinue from where we left off.` }],
      } as ModelMessage,
      {
        role: "assistant",
        content: "Understood, I have the session context. Continuing.",
      } as ModelMessage,
    ];
  }

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

function cleanCommitMessage(raw: string): string {
  const firstLine = raw.split("\n")[0] ?? "";
  const trimmed = firstLine.trim().replace(/^["'“”]+|["'“”]+$/g, "");
  const collapsed = trimmed.replace(/\s+/g, " ");
  const noTrailingPunctuation = collapsed.replace(/[.:;!?]+$/g, "");
  if (noTrailingPunctuation.length <= COMMIT_MESSAGE_MAX_LENGTH) return noTrailingPunctuation;
  return noTrailingPunctuation.slice(0, COMMIT_MESSAGE_MAX_LENGTH).trimEnd();
}

function buildCommitMessageContext(params: CommitMessageParams): string | null {
  if (!params.files.length) return null;

  const fileLines: string[] = [];
  const patchSections: string[] = [];
  let totalPatchChars = 0;

  for (const file of params.files.slice(0, COMMIT_MESSAGE_FILE_LIMIT)) {
    fileLines.push(`- ${file.path} (+${file.added}/-${file.deleted})`);

    const patch = file.patch?.trim();
    if (!patch) continue;

    const remaining = COMMIT_MESSAGE_TOTAL_PATCH_LIMIT - totalPatchChars;
    if (remaining <= 0) break;

    const clippedPatch = cap(patch, Math.min(COMMIT_MESSAGE_PATCH_LIMIT, remaining));
    totalPatchChars += clippedPatch.length;
    patchSections.push(`File: ${file.path}\n${clippedPatch}`);
  }

  return [
    `Files changed (${Math.min(params.files.length, COMMIT_MESSAGE_FILE_LIMIT)} shown):`,
    fileLines.join("\n"),
    patchSections.length > 0 ? `\nPatch excerpts:\n\n${patchSections.join("\n\n")}` : "",
  ].join("\n");
}

const MAX_TOOL_STEPS = 75;

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

export async function generateCommitMessage(
  config: AgentBackendConfig,
  params: CommitMessageParams,
): Promise<string | null> {
  const context = buildCommitMessageContext(params);
  if (!context) return null;

  const modelDef = resolveModelForProvider(params.model, params.provider);
  const languageModel = createLanguageModel(modelDef, config);
  const result = streamText({
    model: languageModel,
    messages: [
      { role: "system", content: COMMIT_MESSAGE_PROMPT } as ModelMessage,
      { role: "user", content: context } as ModelMessage,
    ],
    maxOutputTokens: 40,
    temperature: 0.2,
  });

  const rawMessage = await result.text;
  if (!rawMessage) return null;
  const cleaned = cleanCommitMessage(rawMessage);
  return cleaned.length > 0 ? cleaned : null;
}

type UsageAccumulator = {
  totalCostUsd: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCacheReadTokens: number;
  totalCacheWriteTokens: number;
};

type RunContext = {
  config: AgentBackendConfig;
  options: AgentBackendStartOptions;
  logger: ReturnType<typeof createAgentLogger>;
  sessionId: string;
  modelDef: ModelDef;
  languageModel: ReturnType<typeof createLanguageModel>;
  systemPrompt: string;
  mode: AgentMode;
  linkedAbort: AbortController;
  conversationHistory: ModelMessage[];
  usage: UsageAccumulator;
  mcpRuntimes: Awaited<ReturnType<typeof createMCPToolRuntimes>>;
};

function trackUsage(ctx: RunContext, totalUsage: LanguageModelUsage | undefined) {
  if (!totalUsage) return;
  ctx.usage.totalInputTokens += totalUsage.inputTokens ?? 0;
  ctx.usage.totalOutputTokens += totalUsage.outputTokens ?? 0;
  ctx.usage.totalCacheReadTokens += totalUsage.inputTokenDetails?.cacheReadTokens ?? 0;
  ctx.usage.totalCacheWriteTokens += totalUsage.inputTokenDetails?.cacheWriteTokens ?? 0;
  ctx.usage.totalCostUsd += computeCost(totalUsage, ctx.modelDef);
}

function makeToolCallHandler(ctx: RunContext): (meta: ToolCallMetadata) => void {
  return (meta) => {
    ctx.options.onMessage({
      id: meta.toolCallId,
      role: "tool",
      content: typeof meta.output === "string" ? meta.output : JSON.stringify(meta.output),
      toolName: meta.toolName,
      toolInput: meta.input,
      toolResult: meta.metadata,
      toolStatus: "completed",
      timestamp: Date.now(),
      sessionId: ctx.sessionId,
      toolCallId: meta.toolCallId,
    });
  };
}

function makeToolStartHandler(ctx: RunContext): (meta: { toolCallId: string; toolName: string; input: unknown }) => void {
  return (meta) => {
    ctx.options.onMessage({
      id: meta.toolCallId,
      role: "tool",
      content: "",
      toolName: meta.toolName,
      toolInput: meta.input,
      toolStatus: "running",
      timestamp: Date.now(),
      sessionId: ctx.sessionId,
      toolCallId: meta.toolCallId,
    });
  };
}

function makeRequestUserInput(ctx: RunContext): (toolName: string, input: unknown) => Promise<{ denied?: boolean; message?: string; updatedInput?: unknown }> {
  return async (toolName, input) => {
    if (!ctx.options.canUseTool) return { denied: false, updatedInput: input };
    const result = await ctx.options.canUseTool(ctx.sessionId, toolName, input);
    if (result.behavior === "deny") return { denied: true, message: result.message };
    return { denied: false, updatedInput: result.updatedInput };
  };
}

async function pushAndPersist(ctx: RunContext, messages: ModelMessage[]) {
  for (const msg of messages) ctx.conversationHistory.push(msg);
  logAgentEvent(ctx.logger, "DEBUG", "Agent", "persist_messages", {
    sessionId: ctx.sessionId,
    count: messages.length,
    roles: messages.map((m) => m.role),
  });
  appendMessages(
    ctx.options.workspacePath,
    ctx.sessionId,
    messages,
    ctx.options.workspaceId,
  ).catch((err) => {
    logAgentEvent(ctx.logger, "ERROR", "Agent", "persist_failed", {
      sessionId: ctx.sessionId,
      error: err instanceof Error ? err.message : String(err),
    });
  });
}

async function runReadOnlyMode(ctx: RunContext): Promise<void> {
  const { sessionId, mode, linkedAbort, conversationHistory, options, logger } = ctx;
  const isAsk = mode === "ask" || mode === "agent_review";

  const toolCtx: ToolContext = {
    sessionId,
    workspacePath: options.workspacePath,
    abortSignal: linkedAbort.signal,
    onMetadata: () => {},
    requestUserInput: makeRequestUserInput(ctx),
    onToolStart: makeToolStartHandler(ctx),
    mcpTools: ctx.mcpRuntimes,
    readCache: new Map(),
    logger: ctx.logger,
  };

  const toolCallHandler = makeToolCallHandler(ctx);
  logAgentEvent(logger, "DEBUG", "Agent", "read_only_mode tool_set_created", { sessionId, mode });
  const toolSet = mode === "plan"
    ? createPlanningToolSet(toolCtx, toolCallHandler)
    : createReadOnlyToolSet(toolCtx, toolCallHandler);
  const READ_ONLY_MAX_STEPS = 20;
  let attempt = 0;
  let lastFinalText = "";

  while (!linkedAbort.signal.aborted) {
    try {
      const prunedHistory = pruneConversation(conversationHistory);
      logAgentEvent(logger, "DEBUG", "Agent", "read_only stream_start", {
        sessionId,
        mode,
        historySize: prunedHistory.length,
        estimatedTokens: estimateConversationTokens(prunedHistory),
      });
      let currentStreamedText = "";

      const result = streamText({
        model: ctx.languageModel,
        system: ctx.systemPrompt,
        messages: prunedHistory,
        tools: toolSet,
        stopWhen: stepCountIs(READ_ONLY_MAX_STEPS),
        abortSignal: linkedAbort.signal,
        prepareStep: ({ messages, model }) => ({
          messages: addCacheControl({ messages, model }),
        }),
        onError: ({ error }) => {
          const err = error as { message?: string; statusCode?: number };
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

      trackUsage(ctx, await result.totalUsage);

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

      await pushAndPersist(ctx, response.messages.map(m => m as ModelMessage));
      attempt = 0;

      logAgentEvent(logger, "DEBUG", "Agent", "read_only step_complete", {
        sessionId,
        mode,
        finishReason,
        newMessagesCount: response.messages.length,
      });

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
}

async function runAgentMode(ctx: RunContext): Promise<void> {
  const { config, sessionId, modelDef, linkedAbort, conversationHistory, options, logger } = ctx;

  const offloader = await initOffloader(options.workspacePath, options.workspaceId);

  const toolCtx: ToolContext = {
    sessionId,
    workspacePath: options.workspacePath,
    abortSignal: linkedAbort.signal,
    onMetadata: () => {},
    requestUserInput: makeRequestUserInput(ctx),
    onToolStart: makeToolStartHandler(ctx),
    subAgent: {
      languageModel: createLanguageModel(getCheapModel(modelDef), config),
      systemPrompt: ctx.systemPrompt,
    },
    mcpTools: ctx.mcpRuntimes,
    offloader,
    readCache: new Map(),
    logger: ctx.logger,
  };

  logAgentEvent(logger, "DEBUG", "Agent", "agent_mode tool_set_created", { sessionId });
  const toolSet = createToolSet(toolCtx, makeToolCallHandler(ctx));
  const contextWindowTokens = modelDef.contextWindowTokens;
  let attempt = 0;

  while (!linkedAbort.signal.aborted) {
    try {
      const estimatedTokens = estimateConversationTokens(conversationHistory);
      logAgentEvent(logger, "DEBUG", "Agent", "agent stream_start", {
        sessionId,
        estimatedTokens,
        contextWindowTokens,
        historySize: conversationHistory.length,
      });

      if (estimatedTokens > contextWindowTokens * PROACTIVE_COMPACTION_RATIO) {
        logAgentEvent(logger, "INFO", "Agent", "proactive compaction", {
          sessionId,
          estimatedTokens,
          threshold: Math.floor(contextWindowTokens * PROACTIVE_COMPACTION_RATIO),
        });

        const compacted = await compactConversation(conversationHistory, modelDef, config, linkedAbort.signal);
        if (compacted) {
          conversationHistory.length = 0;
          conversationHistory.push(...compacted);

          options.onMessage({
            id: ulid(),
            role: "system",
            content: "Context approaching limit — older conversation has been summarized to continue. Recent context preserved.",
            timestamp: Date.now(),
            sessionId,
          });
        }
      }

      const prunedHistory = pruneConversation(conversationHistory);
      logAgentEvent(logger, "DEBUG", "Agent", "agent stream_start", {
        sessionId,
        prunedSize: prunedHistory.length,
      });
      let currentStreamedText = "";

      const result = streamText({
        model: ctx.languageModel,
        system: ctx.systemPrompt,
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

      trackUsage(ctx, await result.totalUsage);

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

      await pushAndPersist(ctx, response.messages.map(m => m as ModelMessage));
      attempt = 0;

      logAgentEvent(logger, "DEBUG", "Agent", "agent step_complete", {
        sessionId,
        finishReason,
        newMessagesCount: response.messages.length,
      });

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

async function runAgent(
  config: AgentBackendConfig,
  options: AgentBackendStartOptions,
  activeSessions: Map<string, AbortController>,
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
  logAgentEvent(logger, "DEBUG", "Agent", "system_prompt_built", {
    sessionId,
    mode,
    promptLength: systemPrompt.length,
  });

  options.onMessage({
    id: `${sessionId}-generated-system-prompt`,
    role: "system",
    content: systemPrompt,
    timestamp: Date.now(),
    sessionId,
    isMeta: true,
    metaType: "generated_system_prompt",
  });

  const abortController = new AbortController();
  activeSessions.set(sessionId, abortController);

  const linkedAbort = new AbortController();
  const onExternalAbort = () => linkedAbort.abort();
  options.abortSignal.addEventListener("abort", onExternalAbort, { once: true });
  abortController.signal.addEventListener("abort", () => linkedAbort.abort(), { once: true });

  const mcpRuntimes = await createMCPToolRuntimes(options.mcpServers, logger);
  logAgentEvent(logger, "DEBUG", "Agent", "mcp_init", {
    sessionId,
    serverCount: mcpRuntimes.length,
    toolNames: mcpRuntimes.flatMap((r) => Object.keys(r.tools)),
  });

  const conversationHistory: ModelMessage[] = (options.existingMessages?.length || options.activeMemory)
    ? buildContextSeed(options.activeMemory, options.existingMessages ?? [])
    : [];
  logAgentEvent(logger, "DEBUG", "Agent", "context_seed_built", {
    sessionId,
    hasActiveMemory: !!options.activeMemory,
    existingMessageCount: options.existingMessages?.length ?? 0,
    seedMessageCount: conversationHistory.length,
  });

  const userContent: Array<{ type: "text"; text: string } | { type: "image"; image: string; mimeType?: string }> = [];
  userContent.push({ type: "text", text: options.prompt });

  if (options.imageAttachments?.length) {
    for (const img of options.imageAttachments) {
      const match = img.dataUrl.match(/^data:([^;]+);base64,(.+)$/);
      if (match) {
        userContent.push({ type: "image", image: match[2], mimeType: match[1] });
      }
    }
  }

  const userMessage = { role: "user", content: userContent } as ModelMessage;
  conversationHistory.push(userMessage);
  appendMessages(options.workspacePath, sessionId, [userMessage], options.workspaceId).catch((err) => {
    logAgentEvent(logger, "ERROR", "Persistence", "append user message failed", {
      sessionId,
      error: err instanceof Error ? err.message : String(err),
    });
  });

  const ctx: RunContext = {
    config,
    options,
    logger,
    sessionId,
    modelDef,
    languageModel,
    systemPrompt,
    mode,
    linkedAbort,
    conversationHistory,
    usage: { totalCostUsd: 0, totalInputTokens: 0, totalOutputTokens: 0, totalCacheReadTokens: 0, totalCacheWriteTokens: 0 },
    mcpRuntimes,
  };

  try {
    if (mode === "ask" || mode === "plan" || mode === "agent_review") {
      await runReadOnlyMode(ctx);
    } else {
      await runAgentMode(ctx);
    }
  } finally {
    options.abortSignal.removeEventListener("abort", onExternalAbort);
    activeSessions.delete(sessionId);
    await closeMCPToolRuntimes(mcpRuntimes, logger);
  }

  let activeMemory: string | null = null;
  if (conversationHistory.length > 5 && mode === "agent") {
    activeMemory = await generateActiveMemory(
      conversationHistory,
      modelDef,
      config,
      AbortSignal.timeout(15_000),
    );
  }

  const { usage } = ctx;
  logAgentEvent(logger, "INFO", "Agent", "session result", {
    sessionId,
    totalCostUsd: usage.totalCostUsd,
    inputTokens: usage.totalInputTokens,
    outputTokens: usage.totalOutputTokens,
    cacheReadTokens: usage.totalCacheReadTokens,
    cacheWriteTokens: usage.totalCacheWriteTokens,
    hasActiveMemory: !!activeMemory,
  });

  options.onResult({
    sessionId,
    success: true,
    totalCostUsd: usage.totalCostUsd,
    inputTokens: usage.totalInputTokens,
    outputTokens: usage.totalOutputTokens,
    cacheReadTokens: usage.totalCacheReadTokens,
    cacheWriteTokens: usage.totalCacheWriteTokens,
    activeMemory: activeMemory ?? undefined,
  });
}

function splitForCompaction(
  messages: ModelMessage[],
  keepRecentTokens: number,
): { older: ModelMessage[]; recent: ModelMessage[] } {
  let recentTokens = 0;
  let splitIndex = messages.length;

  for (let i = messages.length - 1; i >= 0; i--) {
    const content = typeof messages[i].content === "string"
      ? messages[i].content as string
      : JSON.stringify(messages[i].content);
    const tokens = Math.ceil(content.length / 4);
    if (recentTokens + tokens > keepRecentTokens) break;
    recentTokens += tokens;
    splitIndex = i;
  }

  if (splitIndex <= 2) {
    return { older: messages, recent: [] };
  }

  return {
    older: messages.slice(0, splitIndex),
    recent: messages.slice(splitIndex),
  };
}

async function compactConversation(
  messages: ModelMessage[],
  modelDef: ModelDef,
  config: AgentBackendConfig,
  signal: AbortSignal,
): Promise<ModelMessage[] | null> {
  const logger = createAgentLogger(config.logger);
  try {
    const { older, recent } = splitForCompaction(messages, COMPACTION_KEEP_RECENT_TOKENS);

    const languageModel = createLanguageModel(getCheapModel(modelDef), config);
    const compactionMessages: ModelMessage[] = [
      ...older,
      { role: "user", content: COMPACTION_PROMPT } as ModelMessage,
    ];

    const result = streamText({
      model: languageModel,
      messages: addCacheControl({
        messages: compactionMessages,
        model: languageModel,
      }),
      abortSignal: signal,
    });

    const summary = await result.text;
    if (!summary) return null;

    return [
      { role: "assistant", content: summary } as ModelMessage,
      {
        role: "user",
        content: "Continue with the task. The above is a summary of the earlier part of our conversation.",
      } as ModelMessage,
      ...recent,
    ];
  } catch (err: unknown) {
    logAgentEvent(logger, "ERROR", "Agent", "compaction failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

async function generateActiveMemory(
  messages: ModelMessage[],
  modelDef: ModelDef,
  config: AgentBackendConfig,
  signal: AbortSignal,
): Promise<string | null> {
  const logger = createAgentLogger(config.logger);
  try {
    const languageModel = createLanguageModel(getCheapModel(modelDef), config);
    const memoryMessages: ModelMessage[] = [
      ...messages,
      { role: "user", content: ACTIVE_MEMORY_PROMPT } as ModelMessage,
    ];

    const result = streamText({
      model: languageModel,
      messages: addCacheControl({
        messages: memoryMessages,
        model: languageModel,
      }),
      abortSignal: signal,
      maxOutputTokens: 2000,
    });

    const memory = await result.text;
    return memory?.trim() || null;
  } catch (err: unknown) {
    logAgentEvent(logger, "WARN", "Agent", "active memory generation failed", {
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
  const activeSessions = new Map<string, AbortController>();

  return {
    provider: "claude",
    capabilities: {
      supportedModes: [...capabilities.supportedModes],
      supportsToolApproval: capabilities.supportsToolApproval,
      supportsImageAttachments: capabilities.supportsImageAttachments,
      supportsResume: capabilities.supportsResume,
    },
    get models() {
      return MODELS.map((m) => ({
        value: m.value,
        label: m.label,
        provider: m.uiProvider,
      }));
    },
    async start(options) {
      await runAgent(config, options, activeSessions);
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

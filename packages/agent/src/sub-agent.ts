import {
  streamText,
  stepCountIs,
  type ModelMessage,
  type LanguageModel,
} from "ai";
import { createReadOnlyToolSet } from "./tools/registry.js";
import type { ToolContext } from "./tools/tool-types.js";
import { addCacheControl } from "./cache.js";

const MAX_STEPS = 15;
const TIMEOUT_MS = 120_000;

const SUB_AGENT_PREAMBLE = `You are a focused research sub-agent. Your job is to explore the codebase and report findings.

Rules:
- Use the available tools (read, grep, glob, ls, readlints) to gather information
- Be thorough but concise in your final summary
- Return a structured summary of what you found
- You CANNOT modify any files — only read and search
- If you cannot find what you are looking for, say so clearly
- Do NOT suggest edits or changes — just report facts`;

export type SubAgentTask = {
  id: string;
  description: string;
  prompt: string;
};

export type SubAgentOptions = {
  task: SubAgentTask;
  workspacePath: string;
  abortSignal: AbortSignal;
  parentSessionId: string;
  languageModel: LanguageModel;
  systemPrompt: string;
};

export type SubAgentResult = {
  taskId: string;
  description: string;
  status: "completed" | "failed" | "aborted";
  output: string;
  error?: string;
  inputTokens: number;
  outputTokens: number;
};

export async function runSubAgent(opts: SubAgentOptions): Promise<SubAgentResult> {
  const { task, workspacePath, languageModel, systemPrompt } = opts;
  const sessionId = `${opts.parentSessionId}:sub:${task.id}`;

  const subAbort = new AbortController();
  const onParentAbort = () => subAbort.abort();
  opts.abortSignal.addEventListener("abort", onParentAbort, { once: true });

  const timeout = setTimeout(() => subAbort.abort(), TIMEOUT_MS);

  const toolCtx: ToolContext = {
    sessionId,
    workspacePath,
    abortSignal: subAbort.signal,
    onMetadata: () => {},
    requestUserInput: async () => ({ denied: false }),
  };

  const tools = createReadOnlyToolSet(toolCtx);
  const history: ModelMessage[] = [
    { role: "user", content: task.prompt } as ModelMessage,
  ];

  let totalInput = 0;
  let totalOutput = 0;

  try {
    while (!subAbort.signal.aborted) {
      const result = streamText({
        model: languageModel,
        system: `${SUB_AGENT_PREAMBLE}\n\n${systemPrompt}`,
        messages: history,
        tools,
        stopWhen: stepCountIs(MAX_STEPS),
        abortSignal: subAbort.signal,
        prepareStep: ({ messages, model }) => ({
          messages: addCacheControl({ messages, model }),
        }),
      });

      const text = await result.text;
      const finishReason = await result.finishReason;
      const response = await result.response;
      const usage = await result.totalUsage;

      if (usage) {
        totalInput += usage.inputTokens ?? 0;
        totalOutput += usage.outputTokens ?? 0;
      }

      for (const msg of response.messages) {
        history.push(msg as ModelMessage);
      }

      if (finishReason !== "tool-calls") {
        return {
          taskId: task.id,
          description: task.description,
          status: "completed",
          output: text || "(no output)",
          inputTokens: totalInput,
          outputTokens: totalOutput,
        };
      }
    }

    return {
      taskId: task.id,
      description: task.description,
      status: "aborted",
      output: "",
      inputTokens: totalInput,
      outputTokens: totalOutput,
    };
  } catch (err) {
    if (subAbort.signal.aborted) {
      return {
        taskId: task.id,
        description: task.description,
        status: "aborted",
        output: "",
        inputTokens: totalInput,
        outputTokens: totalOutput,
      };
    }

    return {
      taskId: task.id,
      description: task.description,
      status: "failed",
      output: "",
      error: err instanceof Error ? err.message : String(err),
      inputTokens: totalInput,
      outputTokens: totalOutput,
    };
  } finally {
    clearTimeout(timeout);
    opts.abortSignal.removeEventListener("abort", onParentAbort);
  }
}

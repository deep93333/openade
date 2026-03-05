import { z } from "zod";
import { ulid } from "ulid";
import type { ToolDefinition } from "./tool-types.js";
import { truncateOutput } from "./tool-types.js";
import { runSubAgent, type SubAgentResult } from "../sub-agent.js";

const MAX_CONCURRENT_TASKS = 5;

const delegateParameters = z.object({
  tasks: z
    .array(
      z.object({
        description: z
          .string()
          .describe("Short label for this research task (3-8 words)"),
        prompt: z
          .string()
          .describe(
            "Detailed instructions telling the sub-agent what to explore, search, or read",
          ),
      }),
    )
    .min(1)
    .max(MAX_CONCURRENT_TASKS)
    .describe("Independent read-only research tasks to run in parallel"),
});

function formatResults(results: PromiseSettledResult<SubAgentResult>[], tasks: z.infer<typeof delegateParameters>["tasks"]): string {
  const sections = results.map((r, i) => {
    const task = tasks[i];
    const header = `## Task: ${task.description}`;

    if (r.status === "rejected") {
      return `${header}\nStatus: rejected\nError: ${r.reason}`;
    }

    const sub = r.value;
    const statusLine = `Status: ${sub.status}`;
    const tokensLine = `Tokens: ${sub.inputTokens} in / ${sub.outputTokens} out`;
    const errorLine = sub.error ? `Error: ${sub.error}` : "";
    const body = sub.output || "(no output)";

    return [header, statusLine, tokensLine, errorLine, "", body]
      .filter(Boolean)
      .join("\n");
  });

  return sections.join("\n\n---\n\n");
}

export const delegateTool: ToolDefinition<typeof delegateParameters> = {
  id: "delegate",
  description:
    "Spawn read-only sub-agents to research the codebase in parallel. Each sub-agent can read files, search with grep/glob, and list directories. Use this when you need to explore multiple unrelated areas of the codebase simultaneously. Sub-agents cannot modify files.",
  parameters: delegateParameters,
  execute: async (args, ctx) => {
    if (!ctx.subAgent) {
      return {
        title: "Delegate unavailable",
        output: "Sub-agent capability is not configured for this session.",
        metadata: {},
      };
    }

    const { languageModel, systemPrompt } = ctx.subAgent;

    const subAgentPromises = args.tasks.map((task) =>
      runSubAgent({
        task: { id: ulid(), description: task.description, prompt: task.prompt },
        workspacePath: ctx.workspacePath,
        abortSignal: ctx.abortSignal,
        parentSessionId: ctx.sessionId,
        languageModel,
        systemPrompt,
      }),
    );

    const results = await Promise.allSettled(subAgentPromises);

    const completed = results.filter(
      (r): r is PromiseFulfilledResult<SubAgentResult> =>
        r.status === "fulfilled" && r.value.status === "completed",
    );

    const totalTokens = results.reduce(
      (acc, r) => {
        if (r.status === "fulfilled") {
          acc.input += r.value.inputTokens;
          acc.output += r.value.outputTokens;
        }
        return acc;
      },
      { input: 0, output: 0 },
    );

    const output = formatResults(results, args.tasks);

    return {
      title: `Delegated ${args.tasks.length} sub-agents (${completed.length} completed)`,
      output: truncateOutput(output),
      metadata: {
        taskCount: args.tasks.length,
        completedCount: completed.length,
        totalInputTokens: totalTokens.input,
        totalOutputTokens: totalTokens.output,
      },
    };
  },
};

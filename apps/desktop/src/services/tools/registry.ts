import { tool, zodSchema, type ToolSet } from "ai";
import { bashTool } from "./bash";
import { readTool } from "./read";
import { writeTool } from "./write";
import { editTool } from "./edit";
import { globTool } from "./glob";
import { grepTool } from "./grep";
import { lsTool } from "./ls";
import { todoWriteTool } from "./todowrite";
import { deleteTool } from "./delete";
import { readLintsTool } from "./readlints";
import { askQuestionTool } from "./ask-question";
import type { ToolContext, ToolDefinition } from "./tool-types";

export type ToolCallMetadata = {
  toolName: string;
  input: unknown;
  output: string;
  metadata: Record<string, unknown>;
  title: string;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function wrapTool(
  def: ToolDefinition,
  ctx: ToolContext,
  onToolCall?: (meta: ToolCallMetadata) => void,
): ReturnType<typeof tool> {
  return tool({
    description: def.description,
    inputSchema: zodSchema(def.parameters) as never,
    execute: async (args: unknown) => {
      const result = await def.execute(args, ctx);
      onToolCall?.({
        toolName: def.id,
        input: args,
        output: result.output,
        metadata: result.metadata,
        title: result.title,
      });
      return result.output;
    },
  } as never);
}

export function createToolSet(
  ctx: ToolContext,
  onToolCall?: (meta: ToolCallMetadata) => void,
): ToolSet {
  return {
    bash: wrapTool(bashTool, ctx, onToolCall),
    read: wrapTool(readTool, ctx, onToolCall),
    write: wrapTool(writeTool, ctx, onToolCall),
    edit: wrapTool(editTool, ctx, onToolCall),
    glob: wrapTool(globTool, ctx, onToolCall),
    grep: wrapTool(grepTool, ctx, onToolCall),
    ls: wrapTool(lsTool, ctx, onToolCall),
    todowrite: wrapTool(todoWriteTool, ctx, onToolCall),
    delete: wrapTool(deleteTool, ctx, onToolCall),
    readlints: wrapTool(readLintsTool, ctx, onToolCall),
    ask_question: wrapTool(askQuestionTool, ctx, onToolCall),
  };
}

export function getToolIds(): string[] {
  return [bashTool, readTool, writeTool, editTool, globTool, grepTool, lsTool, todoWriteTool, deleteTool, readLintsTool, askQuestionTool].map(
    (t) => t.id,
  );
}

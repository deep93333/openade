import { ulid } from "ulid";
import { tool, zodSchema, type ToolSet } from "ai";
import { bashTool } from "./bash.js";
import { readTool } from "./read.js";
import { writeTool } from "./write.js";
import { editTool } from "./edit.js";
import { globTool } from "./glob.js";
import { grepTool } from "./grep.js";
import { lsTool } from "./ls.js";
import { todoWriteTool } from "./todowrite.js";
import { deleteTool } from "./delete.js";
import { readLintsTool } from "./readlints.js";
import { askQuestionTool } from "./ask-question.js";
import type { ToolContext, ToolDefinition } from "./tool-types.js";

export type ToolCallMetadata = {
  toolName: string;
  toolCallId: string;
  input: unknown;
  output: string;
  metadata: Record<string, unknown>;
  title: string;
};

function wrapTool(
  def: ToolDefinition,
  ctx: ToolContext,
  onToolCall?: (meta: ToolCallMetadata) => void,
): ReturnType<typeof tool> {
  return tool({
    description: def.description,
    inputSchema: zodSchema(def.parameters) as never,
    execute: async (args: unknown) => {
      const toolCallId = ulid();

      ctx.onToolStart?.({
        toolName: def.id,
        input: args,
        toolCallId,
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      const result = await def.execute(args, ctx);
      onToolCall?.({
        toolName: def.id,
        toolCallId,
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

export function createReadOnlyToolSet(
  ctx: ToolContext,
  onToolCall?: (meta: ToolCallMetadata) => void,
): ToolSet {
  return {
    read: wrapTool(readTool, ctx, onToolCall),
    glob: wrapTool(globTool, ctx, onToolCall),
    grep: wrapTool(grepTool, ctx, onToolCall),
    ls: wrapTool(lsTool, ctx, onToolCall),
    readlints: wrapTool(readLintsTool, ctx, onToolCall),
  };
}

export function getToolIds(): string[] {
  return [bashTool, readTool, writeTool, editTool, globTool, grepTool, lsTool, todoWriteTool, deleteTool, readLintsTool, askQuestionTool].map(
    (t) => t.id,
  );
}

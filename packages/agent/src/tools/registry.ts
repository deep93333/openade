import { ulid } from "ulid";
import { tool, zodSchema, type ToolSet } from "ai";
import { mergeMCPTools } from "./mcp.js";
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
import { delegateTool } from "./delegate.js";
import { offloadToolOutput } from "../output-offloader.js";
import { logAgentEvent } from "../logger.js";
import type { ToolContext, ToolDefinition } from "./tool-types.js";

export type ToolCallMetadata = {
  toolName: string;
  toolCallId: string;
  input: unknown;
  output: string;
  metadata: Record<string, unknown>;
  title: string;
  fileRef?: { path: string; originalSize: number };
};

const TOOLS_TO_FILE_ON_LONG_OUTPUT = new Set<string>(["bash", "grep"]);
const WRITE_TOOLS = new Set(["bash", "write", "edit", "delete"]);

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

      logAgentEvent(ctx.logger, "DEBUG", "Tool", "tool_start", {
        sessionId: ctx.sessionId,
        toolName: def.id,
        toolCallId,
        input: args,
      });

      ctx.onToolStart?.({
        toolName: def.id,
        input: args,
        toolCallId,
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      if (ctx.requestUserInput && WRITE_TOOLS.has(def.id)) {
        const approval = await ctx.requestUserInput(def.id, args);
        if (approval.denied) {
          logAgentEvent(ctx.logger, "WARN", "Tool", "tool_denied", {
            sessionId: ctx.sessionId,
            toolName: def.id,
            toolCallId,
            reason: approval.message,
          });
          return `Tool denied: ${approval.message ?? "User denied this action"}`;
        }
        if (approval.updatedInput) args = approval.updatedInput;
      }

      let result;
      try {
        result = await def.execute(args, ctx);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        const stack = err instanceof Error ? err.stack : undefined;
        logAgentEvent(ctx.logger, "ERROR", "Tool", "tool_execute_error", {
          sessionId: ctx.sessionId,
          toolName: def.id,
          toolCallId,
          error: message,
          stack: stack?.slice(0, 500),
        });
        throw err;
      }

      let finalOutput = result.output;
      let fileRef: { path: string; originalSize: number } | undefined;

      if (ctx.offloader && TOOLS_TO_FILE_ON_LONG_OUTPUT.has(def.id)) {
        const processed = await offloadToolOutput(ctx.offloader, def.id, result.output);
        finalOutput = processed.output;
        if (processed.fileRef) {
          fileRef = { path: processed.fileRef.path, originalSize: processed.fileRef.originalSize };
          logAgentEvent(ctx.logger, "DEBUG", "Tool", "tool_output_offloaded", {
            sessionId: ctx.sessionId,
            toolName: def.id,
            toolCallId,
            path: processed.fileRef.path,
            originalSize: processed.fileRef.originalSize,
          });
        }
      }

      logAgentEvent(ctx.logger, "DEBUG", "Tool", "tool_complete", {
        sessionId: ctx.sessionId,
        toolName: def.id,
        toolCallId,
        outputLength: finalOutput.length,
      });

      onToolCall?.({
        toolName: def.id,
        toolCallId,
        input: args,
        output: finalOutput,
        metadata: { ...result.metadata, fileRef },
        title: result.title,
        fileRef,
      });
      return finalOutput;
    },
  } as never);
}

export function createToolSet(
  ctx: ToolContext,
  onToolCall?: (meta: ToolCallMetadata) => void,
): ToolSet {
  const tools: ToolSet = {
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

  if (ctx.subAgent) {
    tools.delegate = wrapTool(delegateTool, ctx, onToolCall);
  }

  return mergeMCPTools(tools, ctx.mcpTools);
}

export function createReadOnlyToolSet(
  ctx: ToolContext,
  onToolCall?: (meta: ToolCallMetadata) => void,
): ToolSet {
  return mergeMCPTools({
    read: wrapTool(readTool, ctx, onToolCall),
    glob: wrapTool(globTool, ctx, onToolCall),
    grep: wrapTool(grepTool, ctx, onToolCall),
    ls: wrapTool(lsTool, ctx, onToolCall),
    readlints: wrapTool(readLintsTool, ctx, onToolCall),
  }, ctx.mcpTools);
}

export function createPlanningToolSet(
  ctx: ToolContext,
  onToolCall?: (meta: ToolCallMetadata) => void,
): ToolSet {
  // Planning mode: exploration/search tools + todo management + questions
  // No file modifications allowed (no write, edit, delete, bash)
  return mergeMCPTools({
    read: wrapTool(readTool, ctx, onToolCall),
    glob: wrapTool(globTool, ctx, onToolCall),
    grep: wrapTool(grepTool, ctx, onToolCall),
    ls: wrapTool(lsTool, ctx, onToolCall),
    readlints: wrapTool(readLintsTool, ctx, onToolCall),
    todowrite: wrapTool(todoWriteTool, ctx, onToolCall),
    ask_question: wrapTool(askQuestionTool, ctx, onToolCall),
  }, ctx.mcpTools);
}

export function getToolIds(): string[] {
  return [bashTool, readTool, writeTool, editTool, globTool, grepTool, lsTool, todoWriteTool, deleteTool, readLintsTool, askQuestionTool, delegateTool].map(
    (t) => t.id,
  );
}

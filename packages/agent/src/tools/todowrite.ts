import { z } from "zod";
import type { ToolDefinition, ToolResult } from "./tool-types.js";

const todoItemSchema = z.object({
  id: z.string().describe("Unique identifier for the TODO item"),
  content: z.string().describe("The description/content of the todo item"),
  status: z
    .enum(["pending", "in_progress", "completed", "cancelled"])
    .describe("The current status of the TODO item"),
});

export const todoWriteParameters = z.object({
  todos: z
    .array(todoItemSchema)
    .min(1)
    .describe("Array of TODO items to create or update"),
});

export const todoWriteTool: ToolDefinition<typeof todoWriteParameters> = {
  id: "todowrite",
  description: `Manage a structured task list. Only use for tasks with 3+ steps — skip for simple 1-2 step work. States: pending, in_progress (one at a time), completed, cancelled. Mark tasks done immediately after finishing.`,
  parameters: todoWriteParameters,
  async execute(args): Promise<ToolResult> {
    const completed = args.todos.filter((t: { status: string }) => t.status === "completed").length;
    const inProgress = args.todos.filter((t: { status: string }) => t.status === "in_progress").length;
    const pending = args.todos.filter((t: { status: string }) => t.status === "pending").length;
    const cancelled = args.todos.filter((t: { status: string }) => t.status === "cancelled").length;

    const summary = [
      `${args.todos.length} task(s)`,
      completed > 0 ? `${completed} completed` : null,
      inProgress > 0 ? `${inProgress} in progress` : null,
      pending > 0 ? `${pending} pending` : null,
      cancelled > 0 ? `${cancelled} cancelled` : null,
    ]
      .filter(Boolean)
      .join(", ");

    return {
      title: "Todo",
      output: summary,
      metadata: { todos: args.todos },
    };
  },
};

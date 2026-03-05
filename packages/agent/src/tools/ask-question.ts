import { z } from "zod";
import type { ToolDefinition, ToolResult } from "./tool-types.js";

const optionSchema = z.object({
  label: z.string().describe("Display text for this option"),
  description: z.string().optional().describe("Optional description for the option"),
});

const questionSchema = z.object({
  question: z.string().describe("The question text to display"),
  header: z.string().optional().describe("Optional header/title for the question"),
  options: z.array(optionSchema).min(2).describe("Answer options (minimum 2)"),
  multiSelect: z.boolean().optional().describe("If true, user can select multiple options"),
});

export const askQuestionParameters = z.object({
  questions: z.array(questionSchema).min(1).describe("Questions to present to the user"),
});

export const askQuestionTool: ToolDefinition<typeof askQuestionParameters> = {
  id: "ask_question",
  description: `Ask the user structured multiple-choice questions. Use when you need specific input to proceed (e.g., choosing between approaches, confirming options). Set multiSelect: true when multiple options may apply. The user can always type a custom free-text answer in addition to the predefined options. Returns the user's selected and/or typed answers.`,
  parameters: askQuestionParameters,
  async execute(args, ctx): Promise<ToolResult> {
    const response = await ctx.requestUserInput("ask_question", args);

    if (response.denied) {
      return {
        title: "Ask Question",
        output: `User declined to answer: ${response.message ?? "No reason given"}`,
        metadata: { denied: true },
      };
    }

    const updatedInput = response.updatedInput as Record<string, unknown> | undefined;
    const responses = (updatedInput?.responses ?? []) as Array<{
      header?: string;
      question: string;
      answers: string[];
    }>;

    const lines: string[] = [];
    for (const r of responses) {
      lines.push(`Q: ${r.question}`);
      if (r.answers.length === 0) {
        lines.push("A: (no answer selected)");
      } else {
        lines.push(`A: ${r.answers.join(", ")}`);
      }
      lines.push("");
    }

    return {
      title: "Ask Question",
      output: lines.join("\n").trim() || "No responses received.",
      metadata: { responses },
    };
  },
};

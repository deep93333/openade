import { z } from "zod";
import * as fs from "fs/promises";
import * as path from "path";
import type { ToolDefinition, ToolResult } from "./tool-types.js";

export const editParameters = z.object({
  file_path: z.string().describe("Absolute path to the file to edit"),
  old_string: z.string().describe("The exact string to find and replace (must be unique in the file)"),
  new_string: z.string().describe("The replacement string"),
});

export const editTool: ToolDefinition<typeof editParameters> = {
  id: "edit",
  description: `Replace an exact unique string in a file. old_string must match exactly (whitespace included) and appear only once. Include 3-5 lines of context to ensure uniqueness.`,
  parameters: editParameters,
  async execute(args, ctx): Promise<ToolResult> {
    let filepath = args.file_path;
    if (!path.isAbsolute(filepath)) {
      filepath = path.resolve(ctx.workspacePath, filepath);
    }
    const title = path.relative(ctx.workspacePath, filepath);

    const content = await fs.readFile(filepath, "utf-8");

    if (args.old_string === args.new_string) {
      throw new Error("old_string and new_string must be different");
    }

    const occurrences = content.split(args.old_string).length - 1;
    if (occurrences === 0) {
      const lines = content.split("\n");
      const preview = lines.slice(0, 20).join("\n");
      throw new Error(
        `old_string not found in ${filepath}.\n\nFile starts with:\n${preview}\n\n(${lines.length} total lines)`,
      );
    }
    if (occurrences > 1) {
      throw new Error(
        `old_string found ${occurrences} times in ${filepath}. It must be unique — include more surrounding context to disambiguate.`,
      );
    }

    const newContent = content.replace(args.old_string, args.new_string);
    await fs.writeFile(filepath, newContent, "utf-8");

    const oldLines = args.old_string.split("\n").length;
    const newLines = args.new_string.split("\n").length;
    const output = `Edited ${filepath}: replaced ${oldLines} line(s) with ${newLines} line(s)`;

    return {
      title,
      output,
      metadata: {
        file_path: filepath,
        old_string: args.old_string,
        new_string: args.new_string,
        old_lines: oldLines,
        new_lines: newLines,
      },
    };
  },
};

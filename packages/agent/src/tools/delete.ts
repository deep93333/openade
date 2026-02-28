import { z } from "zod";
import * as fs from "fs/promises";
import * as path from "path";
import type { ToolDefinition, ToolResult } from "./tool-types.js";

export const deleteParameters = z.object({
  file_path: z.string().describe("Absolute path to the file to delete"),
});

export const deleteTool: ToolDefinition<typeof deleteParameters> = {
  id: "delete",
  description: `Delete a file at the specified path. Will fail gracefully if the file doesn't exist.`,
  parameters: deleteParameters,
  async execute(args, ctx): Promise<ToolResult> {
    let filepath = args.file_path;
    if (!path.isAbsolute(filepath)) {
      filepath = path.resolve(ctx.workspacePath, filepath);
    }
    const title = path.relative(ctx.workspacePath, filepath);

    let size = 0;
    try {
      const stat = await fs.stat(filepath);
      size = stat.size;
    } catch {
      throw new Error(`File not found: ${filepath}`);
    }

    await fs.unlink(filepath);

    return {
      title,
      output: `Deleted ${filepath} (${size} bytes)`,
      metadata: { file_path: filepath, size },
    };
  },
};

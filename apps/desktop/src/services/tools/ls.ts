import { z } from "zod";
import * as fs from "fs/promises";
import * as path from "path";
import type { ToolDefinition, ToolResult } from "./tool-types";

export const lsParameters = z.object({
  path: z.string().describe("Absolute path to the directory to list"),
});

export const lsTool: ToolDefinition<typeof lsParameters> = {
  id: "ls",
  description: `List directory contents with file types. Shows files and subdirectories with trailing '/' for directories.`,
  parameters: lsParameters,
  async execute(args, ctx): Promise<ToolResult> {
    let dirPath = args.path;
    if (!path.isAbsolute(dirPath)) {
      dirPath = path.resolve(ctx.workspacePath, dirPath);
    }

    const dirents = await fs.readdir(dirPath, { withFileTypes: true });
    const entries = dirents
      .map((d) => (d.isDirectory() ? d.name + "/" : d.name))
      .sort((a, b) => a.localeCompare(b));

    const output = entries.length > 0
      ? entries.join("\n")
      : "(empty directory)";

    return {
      title: path.relative(ctx.workspacePath, dirPath) || ".",
      output,
      metadata: { count: entries.length, path: dirPath },
    };
  },
};

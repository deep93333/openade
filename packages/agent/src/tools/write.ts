import { z } from "zod";
import * as fs from "fs/promises";
import * as path from "path";
import type { ToolDefinition, ToolResult } from "./tool-types.js";

export const writeParameters = z.object({
  file_path: z.string().describe("Absolute path to the file to write"),
  content: z.string().describe("The full content to write to the file"),
});

export const writeTool: ToolDefinition<typeof writeParameters> = {
  id: "write",
  description: `Create a new file or overwrite an existing one. Parent dirs are created automatically. Use 'edit' for partial modifications instead.`,
  parameters: writeParameters,
  async execute(args, ctx): Promise<ToolResult> {
    let filepath = args.file_path;
    if (!path.isAbsolute(filepath)) {
      filepath = path.resolve(ctx.workspacePath, filepath);
    }
    const title = path.relative(ctx.workspacePath, filepath);

    await fs.mkdir(path.dirname(filepath), { recursive: true });

    let existed = false;
    let oldSize = 0;
    try {
      const stat = await fs.stat(filepath);
      existed = true;
      oldSize = stat.size;
    } catch {}

    await fs.writeFile(filepath, args.content, "utf-8");
    const newSize = Buffer.byteLength(args.content, "utf-8");
    const lines = args.content.split("\n").length;

    const action = existed ? "Updated" : "Created";
    const output = `${action} ${filepath} (${lines} lines, ${newSize} bytes)`;

    return {
      title,
      output,
      metadata: {
        file_path: filepath,
        action: existed ? "updated" : "created",
        old_size: oldSize,
        new_size: newSize,
        lines,
      },
    };
  },
};

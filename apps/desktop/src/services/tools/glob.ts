import { z } from "zod";
import { glob } from "node:fs/promises";
import * as path from "path";
import type { ToolDefinition, ToolResult } from "./tool-types";
import { truncateOutput } from "./tool-types";

const IGNORE_DIRS = new Set([
  "node_modules", ".git", ".next", ".turbo", "dist", "build", "out",
  "__pycache__", ".venv", "venv", "target", ".cache", ".idea", ".vscode",
  "coverage", ".nyc_output", ".parcel-cache", ".svelte-kit",
]);

const MAX_FILES = 500;

export const globParameters = z.object({
  pattern: z.string().describe("Glob pattern to match files (e.g. '**/*.ts', 'src/**/*.tsx', '*.json')"),
  path: z.string().optional().describe("Directory to search in (defaults to project root)"),
});

export const globTool: ToolDefinition<typeof globParameters> = {
  id: "glob",
  description: `Find files matching a glob pattern. Supports recursive '**' patterns (e.g. '**/*.ts', 'src/**/*.tsx'). Automatically excludes node_modules, dist, .git, build, and other output directories. Returns relative paths, capped at ${MAX_FILES} results.`,
  parameters: globParameters,
  async execute(args, ctx): Promise<ToolResult> {
    const searchDir = args.path
      ? path.isAbsolute(args.path)
        ? args.path
        : path.resolve(ctx.workspacePath, args.path)
      : ctx.workspacePath;

    try {
      const files: string[] = [];
      let truncated = false;

      for await (const entry of glob(args.pattern, {
        cwd: searchDir,
        exclude: (p) => IGNORE_DIRS.has(p),
      })) {
        if (files.length >= MAX_FILES) {
          truncated = true;
          break;
        }
        files.push(path.relative(ctx.workspacePath, path.resolve(searchDir, entry)));
      }

      files.sort();

      let output: string;
      if (files.length === 0) {
        output = `No files matching '${args.pattern}' found in ${path.relative(ctx.workspacePath, searchDir) || "."}`;
      } else {
        output = `Found ${files.length}${truncated ? `+ (capped at ${MAX_FILES})` : ""} file(s):\n${files.join("\n")}`;
      }

      return {
        title: `glob: ${args.pattern}`,
        output: truncateOutput(output),
        metadata: { count: files.length, pattern: args.pattern, truncated },
      };
    } catch (err) {
      throw new Error(`Glob failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  },
};

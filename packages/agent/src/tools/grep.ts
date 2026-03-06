import { z } from "zod";
import { execFile } from "child_process";
import * as path from "path";
import type { ToolDefinition, ToolResult } from "./tool-types.js";
import { truncateOutput } from "./tool-types.js";
import { IGNORE_DIRS } from "../constants.js";

const EXCLUDE_DIRS = [...IGNORE_DIRS];

const EXEC_OPTS = {
  encoding: "utf-8" as const,
  timeout: 15_000,
  maxBuffer: 2 * 1024 * 1024,
};

export const grepParameters = z.object({
  pattern: z.string().describe("Regex pattern to search for"),
  path: z.string().optional().describe("File or directory to search in (defaults to project root)"),
  include: z.string().optional().describe("File glob to filter (e.g. '*.ts', '*.py')"),
});

function resolveSearchPath(argPath: string | undefined, workspacePath: string): string {
  if (!argPath) return workspacePath;
  return path.isAbsolute(argPath) ? argPath : path.resolve(workspacePath, argPath);
}

function relativizeLine(line: string, workspacePath: string): string {
  const prefix = workspacePath + "/";
  const colonIdx = line.indexOf(":");
  if (colonIdx === -1) return line;
  const filePart = line.substring(0, colonIdx);
  if (filePart.startsWith(prefix)) {
    return filePart.slice(prefix.length) + line.substring(colonIdx);
  }
  return line;
}

function formatResult(stdout: string, pattern: string, workspacePath: string): ToolResult {
  const lines = stdout.trim().split("\n").filter(Boolean);
  const output = lines.length > 0
    ? `Found ${lines.length} match(es):\n${lines.map((l) => relativizeLine(l, workspacePath)).join("\n")}`
    : `No matches found for '${pattern}'`;
  return {
    title: `grep: ${pattern}`,
    output: truncateOutput(output),
    metadata: { count: lines.length, pattern },
  };
}

function noMatchResult(pattern: string): ToolResult {
  return {
    title: `grep: ${pattern}`,
    output: `No matches found for '${pattern}'`,
    metadata: { count: 0, pattern },
  };
}

function runRipgrep(searchPath: string, args: z.infer<typeof grepParameters>, workspacePath: string): Promise<ToolResult> {
  const rgArgs = [
    "--line-number",
    "--no-heading",
    "--color=never",
    "--max-count=200",
    "--max-columns=300",
  ];

  for (const dir of EXCLUDE_DIRS) {
    rgArgs.push("--glob", `!${dir}/**`);
  }
  if (args.include) {
    rgArgs.push("--glob", args.include);
  }
  rgArgs.push("--", args.pattern, searchPath);

  return new Promise<ToolResult>((resolve, reject) => {
    execFile("rg", rgArgs, { ...EXEC_OPTS, cwd: workspacePath }, (err, stdout, stderr) => {
      if (err && !stdout) {
        if ((err as NodeJS.ErrnoException).code === "ENOENT") {
          reject(new RipgrepNotFoundError());
          return;
        }
        const exitCode = (err as { code?: number }).code;
        if (exitCode === 1) {
          resolve(noMatchResult(args.pattern));
          return;
        }
        reject(new Error(`grep failed: ${stderr || err.message}`));
        return;
      }
      resolve(formatResult(stdout, args.pattern, workspacePath));
    });
  });
}

function runSystemGrep(searchPath: string, args: z.infer<typeof grepParameters>, workspacePath: string): Promise<ToolResult> {
  const grepArgs = ["-rn", "--color=never"];

  for (const dir of EXCLUDE_DIRS) {
    grepArgs.push("--exclude-dir", dir);
  }
  if (args.include) {
    grepArgs.push("--include", args.include);
  }
  grepArgs.push("-E", "-m", "200", "--", args.pattern, searchPath);

  return new Promise<ToolResult>((resolve, reject) => {
    execFile("grep", grepArgs, { ...EXEC_OPTS, cwd: workspacePath }, (err, stdout, stderr) => {
      if (err && !stdout) {
        const exitCode = (err as { code?: number }).code;
        if (exitCode === 1) {
          resolve(noMatchResult(args.pattern));
          return;
        }
        reject(new Error(`grep failed: ${stderr || err.message}`));
        return;
      }
      resolve(formatResult(stdout, args.pattern, workspacePath));
    });
  });
}

class RipgrepNotFoundError extends Error {
  constructor() {
    super("ripgrep not found");
  }
}

export const grepTool: ToolDefinition<typeof grepParameters> = {
  id: "grep",
  description: `Search file contents for a regex pattern. Returns matching lines with file paths and line numbers. Use 'include' to filter by file type (e.g. '*.ts'). Automatically excludes node_modules, dist, .git, build, and other output directories. Prefers ripgrep but falls back to system grep.`,
  parameters: grepParameters,
  async execute(args, ctx): Promise<ToolResult> {
    const searchPath = resolveSearchPath(args.path, ctx.workspacePath);
    try {
      return await runRipgrep(searchPath, args, ctx.workspacePath);
    } catch (err) {
      if (err instanceof RipgrepNotFoundError) {
        return runSystemGrep(searchPath, args, ctx.workspacePath);
      }
      throw err;
    }
  },
};

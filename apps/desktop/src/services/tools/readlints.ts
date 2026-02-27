import { z } from "zod";
import { execFile } from "child_process";
import * as fs from "fs/promises";
import * as path from "path";
import type { ToolDefinition, ToolResult } from "./tool-types";
import { truncateOutput } from "./tool-types";

const TIMEOUT = 30_000;

type Diagnostic = {
  file: string;
  line: number;
  col: number;
  severity: "error" | "warning";
  message: string;
};

function parseTscOutput(raw: string, workspacePath: string): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const lines = raw.split("\n");
  for (const line of lines) {
    const match = line.match(/^(.+?)\((\d+),(\d+)\):\s+(error|warning)\s+TS\d+:\s+(.+)$/);
    if (match) {
      diagnostics.push({
        file: path.relative(workspacePath, match[1]),
        line: parseInt(match[2], 10),
        col: parseInt(match[3], 10),
        severity: match[4] as "error" | "warning",
        message: match[5].trim(),
      });
    }
  }
  return diagnostics;
}

function parseEslintCompact(raw: string, workspacePath: string): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const lines = raw.split("\n");
  for (const line of lines) {
    const match = line.match(/^(.+?):\s+line\s+(\d+),\s+col\s+(\d+),\s+(Error|Warning)\s+-\s+(.+)$/);
    if (match) {
      diagnostics.push({
        file: path.relative(workspacePath, match[1]),
        line: parseInt(match[2], 10),
        col: parseInt(match[3], 10),
        severity: match[4].toLowerCase() as "error" | "warning",
        message: match[5].trim(),
      });
    }
  }
  return diagnostics;
}

async function fileExists(filepath: string): Promise<boolean> {
  try {
    await fs.access(filepath);
    return true;
  } catch {
    return false;
  }
}

function runCommand(cmd: string, args: string[], cwd: string): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    execFile(cmd, args, { encoding: "utf-8", timeout: TIMEOUT, maxBuffer: 2 * 1024 * 1024, cwd }, (err, stdout, stderr) => {
      resolve({ stdout: stdout ?? "", stderr: stderr ?? "" });
    });
  });
}

function formatDiagnostics(diagnostics: Diagnostic[]): string {
  if (diagnostics.length === 0) return "No errors or warnings found.";

  const grouped = new Map<string, Diagnostic[]>();
  for (const d of diagnostics) {
    const list = grouped.get(d.file) ?? [];
    list.push(d);
    grouped.set(d.file, list);
  }

  const errors = diagnostics.filter((d) => d.severity === "error").length;
  const warnings = diagnostics.filter((d) => d.severity === "warning").length;

  const lines: string[] = [];
  lines.push(`Found ${diagnostics.length} diagnostic(s): ${errors} error(s), ${warnings} warning(s)\n`);

  for (const [file, diags] of grouped) {
    lines.push(`${file}:`);
    for (const d of diags) {
      const sev = d.severity === "error" ? "ERROR" : "WARN";
      lines.push(`  ${d.line}:${d.col} ${sev} ${d.message}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

export const readLintsParameters = z.object({
  paths: z
    .array(z.string())
    .optional()
    .describe("Optional file paths to check. If omitted, checks the whole project."),
});

export const readLintsTool: ToolDefinition<typeof readLintsParameters> = {
  id: "readlints",
  description: `Run TypeScript or ESLint diagnostics and return errors/warnings. Optionally filter to specific file paths. Use after edits to verify correctness.`,
  parameters: readLintsParameters,
  async execute(args, ctx): Promise<ToolResult> {
    const workspacePath = ctx.workspacePath;
    let allDiagnostics: Diagnostic[] = [];
    const tools: string[] = [];

    const hasTsconfig = await fileExists(path.join(workspacePath, "tsconfig.json"));
    if (hasTsconfig) {
      tools.push("tsc");
      const { stdout, stderr } = await runCommand("npx", ["tsc", "--noEmit", "--pretty", "false"], workspacePath);
      const raw = stdout + "\n" + stderr;
      allDiagnostics.push(...parseTscOutput(raw, workspacePath));
    }

    const eslintConfigs = ["eslint.config.js", "eslint.config.mjs", "eslint.config.ts", ".eslintrc.json", ".eslintrc.js", ".eslintrc"];
    let hasEslint = false;
    for (const config of eslintConfigs) {
      if (await fileExists(path.join(workspacePath, config))) {
        hasEslint = true;
        break;
      }
    }

    if (hasEslint) {
      tools.push("eslint");
      const eslintArgs = ["eslint", "--format", "compact", "--no-error-on-unmatched-pattern"];
      if (args.paths?.length) {
        eslintArgs.push(...args.paths);
      } else {
        eslintArgs.push(".");
      }
      const { stdout, stderr } = await runCommand("npx", eslintArgs, workspacePath);
      allDiagnostics.push(...parseEslintCompact(stdout + "\n" + stderr, workspacePath));
    }

    if (tools.length === 0) {
      return {
        title: "Lints",
        output: "No linting tools detected (no tsconfig.json or eslint config found).",
        metadata: { diagnosticCount: 0, tools: [] },
      };
    }

    if (args.paths?.length) {
      const filterPaths = new Set(
        args.paths.map((p) => (path.isAbsolute(p) ? path.relative(workspacePath, p) : p)),
      );
      allDiagnostics = allDiagnostics.filter((d) => filterPaths.has(d.file));
    }

    const output = formatDiagnostics(allDiagnostics);

    return {
      title: "Lints",
      output: truncateOutput(output),
      metadata: {
        diagnosticCount: allDiagnostics.length,
        errors: allDiagnostics.filter((d) => d.severity === "error").length,
        warnings: allDiagnostics.filter((d) => d.severity === "warning").length,
        tools,
        diagnostics: allDiagnostics.slice(0, 50),
      },
    };
  },
};

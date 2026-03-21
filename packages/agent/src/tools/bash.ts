import { z } from "zod";
import { spawn } from "child_process";
import type { ToolDefinition, ToolContext, ToolResult } from "./tool-types.js";
import { truncateOutput } from "./tool-types.js";

const DEFAULT_TIMEOUT = 120_000;
const MAX_METADATA_OUTPUT = 30_000;

const BLOCKED_PATTERNS: RegExp[] = [
  /\brm\s+(-\w*\s+)*-\w*r\w*\s+\//,
  /\bsudo\b/,
  /\bcurl\b.*\|\s*(ba)?sh/,
  /\bwget\b.*\|\s*(ba)?sh/,
  /\beval\b\s*["'`(]/,
  />\s*\/etc\//,
  /\bmkfs\b/,
  /\bdd\b\s+.*of=\//,
];

const SENSITIVE_ENV_PATTERNS: RegExp[] = [
  /API_KEY/i,
  /SECRET/i,
  /TOKEN/i,
  /PASSWORD/i,
  /CREDENTIAL/i,
  /^AWS_/,
  /^GITHUB_TOKEN$/,
  /^NPM_TOKEN$/,
  /^GH_TOKEN$/,
  /PRIVATE_KEY/i,
];

function isBlockedCommand(command: string): string | null {
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(command)) {
      return `Command blocked for safety: matches pattern ${pattern.source}`;
    }
  }
  return null;
}

function scrubEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (value == null) continue;
    if (SENSITIVE_ENV_PATTERNS.some(p => p.test(key))) continue;
    env[key] = value;
  }
  return env;
}

function getShell(): string {
  if (process.platform === "win32") return "cmd.exe";
  return process.env.SHELL || "/bin/bash";
}

function killTree(proc: ReturnType<typeof spawn>): void {
  if (proc.pid == null) return;
  try {
    if (process.platform !== "win32") {
      process.kill(-proc.pid, "SIGTERM");
    } else {
      proc.kill("SIGTERM");
    }
  } catch {
    try {
      proc.kill("SIGKILL");
    } catch {}
  }
}

export const bashParameters = z.object({
  command: z.string().describe("The bash command to execute"),
  timeout: z.number().optional().describe("Timeout in milliseconds (default 120000)"),
  description: z
    .string()
    .describe("Short 5-10 word description of what this command does"),
});

export const bashTool: ToolDefinition<typeof bashParameters> = {
  id: "bash",
  description: `Run a shell command in the project root. Provide a short description. Set timeout for long-running commands. IMPORTANT: Do NOT use bash for searching file contents (use 'grep' tool instead), finding files (use 'glob' tool instead), or reading files (use 'read' tool instead). Reserve bash for git commands, installs, builds, running scripts, and other system operations.`,
  parameters: bashParameters,
  async execute(args, ctx): Promise<ToolResult> {
    const blocked = isBlockedCommand(args.command);
    if (blocked) {
      return {
        title: args.description,
        output: blocked,
        metadata: { output: blocked, exit: 1, description: args.description },
      };
    }

    const timeout = args.timeout ?? DEFAULT_TIMEOUT;
    const shell = getShell();

    const proc = spawn(args.command, {
      shell,
      cwd: ctx.workspacePath,
      env: scrubEnv(),
      stdio: ["ignore", "pipe", "pipe"],
      detached: process.platform !== "win32",
    });

    let output = "";

    ctx.onMetadata({ output: "", description: args.description });

    const append = (chunk: Buffer) => {
      output += chunk.toString();
      ctx.onMetadata({
        output:
          output.length > MAX_METADATA_OUTPUT
            ? output.slice(0, MAX_METADATA_OUTPUT) + "\n\n..."
            : output,
        description: args.description,
      });
    };

    proc.stdout?.on("data", append);
    proc.stderr?.on("data", append);

    let timedOut = false;
    let aborted = false;
    let exited = false;

    const kill = () => {
      if (!exited) killTree(proc);
    };

    if (ctx.abortSignal.aborted) {
      aborted = true;
      kill();
    }

    const abortHandler = () => {
      aborted = true;
      kill();
    };
    ctx.abortSignal.addEventListener("abort", abortHandler, { once: true });

    const timeoutTimer = setTimeout(() => {
      timedOut = true;
      kill();
    }, timeout + 100);

    await new Promise<void>((resolve, reject) => {
      const cleanup = () => {
        clearTimeout(timeoutTimer);
        ctx.abortSignal.removeEventListener("abort", abortHandler);
      };
      proc.once("exit", () => {
        exited = true;
        cleanup();
        resolve();
      });
      proc.once("error", (err) => {
        exited = true;
        cleanup();
        reject(err);
      });
    });

    const notes: string[] = [];
    if (timedOut) notes.push(`Command timed out after ${timeout}ms`);
    if (aborted) notes.push("Command was aborted by user");
    if (notes.length > 0) output += "\n\n" + notes.join("\n");

    return {
      title: args.description,
      output: truncateOutput(output),
      metadata: {
        output:
          output.length > MAX_METADATA_OUTPUT
            ? output.slice(0, MAX_METADATA_OUTPUT) + "\n\n..."
            : output,
        exit: proc.exitCode,
        description: args.description,
      },
    };
  },
};

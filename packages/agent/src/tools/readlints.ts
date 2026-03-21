import { z } from "zod";
import { execFile } from "child_process";
import * as fs from "fs/promises";
import * as path from "path";
import type { ToolDefinition, ToolResult } from "./tool-types.js";
import { truncateOutput } from "./tool-types.js";

const TIMEOUT = 60_000;
const MAX_BUFFER = 4 * 1024 * 1024;

type Diagnostic = {
  file: string;
  line: number;
  col: number;
  severity: "error" | "warning";
  message: string;
  source?: string;
};

type LinterSpec = {
  id: string;
  label: string;
  configFiles: string[];
  markerFiles?: string[];
  fileExtensions?: string[];
  buildCommand: (paths: string[], workspacePath: string) => { cmd: string; args: string[] };
  parse: (stdout: string, stderr: string, workspacePath: string) => Diagnostic[];
};

function runCommand(cmd: string, args: string[], cwd: string): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve) => {
    const proc = execFile(cmd, args, { encoding: "utf-8", timeout: TIMEOUT, maxBuffer: MAX_BUFFER, cwd }, (err, stdout, stderr) => {
      const exitCode = err && "code" in err ? (err as NodeJS.ErrnoException & { code: number }).code ?? 1 : 0;
      resolve({ stdout: stdout ?? "", stderr: stderr ?? "", exitCode: typeof exitCode === "number" ? exitCode : 1 });
    });
    proc.unref?.();
  });
}

async function fileExists(filepath: string): Promise<boolean> {
  try {
    await fs.access(filepath);
    return true;
  } catch {
    return false;
  }
}

async function anyFileExists(dir: string, names: string[]): Promise<boolean> {
  for (const name of names) {
    if (await fileExists(path.join(dir, name))) return true;
  }
  return false;
}

async function commandExists(cmd: string): Promise<boolean> {
  try {
    const { exitCode } = await runCommand("which", [cmd], "/tmp");
    return exitCode === 0;
  } catch {
    return false;
  }
}

async function hasFileWithExtension(dir: string, extensions: string[]): Promise<boolean> {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (extensions.includes(ext)) return true;
      }
      if (entry.isDirectory() && entry.name !== "node_modules" && entry.name !== ".git" && entry.name !== "target" && entry.name !== "__pycache__" && entry.name !== "venv" && entry.name !== ".venv") {
        const nested = await hasFileWithExtension(path.join(dir, entry.name), extensions);
        if (nested) return true;
      }
    }
  } catch {}
  return false;
}

async function hasXcodeProject(dir: string): Promise<{ hasProject: boolean; hasWorkspace: boolean }> {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    let hasProject = false;
    let hasWorkspace = false;
    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (entry.name.endsWith(".xcodeproj")) hasProject = true;
        if (entry.name.endsWith(".xcworkspace")) hasWorkspace = true;
      }
    }
    return { hasProject, hasWorkspace };
  } catch {
    return { hasProject: false, hasWorkspace: false };
  }
}

// --- Parsers ---

function parseTscOutput(raw: string, workspacePath: string): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  for (const line of raw.split("\n")) {
    const match = line.match(/^(.+?)\((\d+),(\d+)\):\s+(error|warning)\s+TS\d+:\s+(.+)$/);
    if (match) {
      diagnostics.push({
        file: path.relative(workspacePath, match[1]),
        line: parseInt(match[2], 10),
        col: parseInt(match[3], 10),
        severity: match[4] as "error" | "warning",
        message: match[5].trim(),
        source: "tsc",
      });
    }
  }
  return diagnostics;
}

function parseEslintCompact(raw: string, workspacePath: string): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  for (const line of raw.split("\n")) {
    const match = line.match(/^(.+?):\s+line\s+(\d+),\s+col\s+(\d+),\s+(Error|Warning)\s+-\s+(.+)$/);
    if (match) {
      diagnostics.push({
        file: path.relative(workspacePath, match[1]),
        line: parseInt(match[2], 10),
        col: parseInt(match[3], 10),
        severity: match[4].toLowerCase() as "error" | "warning",
        message: match[5].trim(),
        source: "eslint",
      });
    }
  }
  return diagnostics;
}

function parsePylintJson(raw: string, workspacePath: string): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  try {
    const items = JSON.parse(raw);
    if (Array.isArray(items)) {
      for (const item of items) {
        diagnostics.push({
          file: path.relative(workspacePath, item.path ?? item.module ?? "unknown"),
          line: item.line ?? 0,
          col: item.column ?? 0,
          severity: item.type === "error" || item.type === "fatal" ? "error" : "warning",
          message: `${item.symbol ?? ""}: ${item.message ?? ""}`.trim(),
          source: "pylint",
        });
      }
    }
  } catch {}
  return diagnostics;
}

function parseRuffOutput(raw: string, workspacePath: string): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  for (const line of raw.split("\n")) {
    const match = line.match(/^(.+?):(\d+):(\d+):\s+(\S+)\s+(.+)$/);
    if (match) {
      diagnostics.push({
        file: path.relative(workspacePath, match[1]),
        line: parseInt(match[2], 10),
        col: parseInt(match[3], 10),
        severity: match[4].startsWith("E") || match[4].startsWith("F") ? "error" : "warning",
        message: `${match[4]} ${match[5]}`.trim(),
        source: "ruff",
      });
    }
  }
  return diagnostics;
}

function parseFlaке8Output(raw: string, workspacePath: string): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  for (const line of raw.split("\n")) {
    const match = line.match(/^(.+?):(\d+):(\d+):\s+(\S+)\s+(.+)$/);
    if (match) {
      diagnostics.push({
        file: path.relative(workspacePath, match[1]),
        line: parseInt(match[2], 10),
        col: parseInt(match[3], 10),
        severity: match[4].startsWith("E") || match[4].startsWith("F") ? "error" : "warning",
        message: `${match[4]} ${match[5]}`.trim(),
        source: "flake8",
      });
    }
  }
  return diagnostics;
}

function parseMypyOutput(raw: string, workspacePath: string): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  for (const line of raw.split("\n")) {
    const match = line.match(/^(.+?):(\d+)(?::(\d+))?:\s+(error|warning|note):\s+(.+)$/);
    if (match && match[4] !== "note") {
      diagnostics.push({
        file: path.relative(workspacePath, match[1]),
        line: parseInt(match[2], 10),
        col: match[3] ? parseInt(match[3], 10) : 1,
        severity: match[4] === "error" ? "error" : "warning",
        message: match[5].trim(),
        source: "mypy",
      });
    }
  }
  return diagnostics;
}

function parseCargoOutput(raw: string, workspacePath: string): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  try {
    for (const line of raw.split("\n")) {
      if (!line.startsWith("{")) continue;
      const msg = JSON.parse(line);
      if (msg.reason !== "compiler-message" || !msg.message) continue;
      const m = msg.message;
      if (m.level === "note" || m.level === "help") continue;
      const span = m.spans?.[0];
      if (!span) continue;
      diagnostics.push({
        file: path.relative(workspacePath, span.file_name ?? "unknown"),
        line: span.line_start ?? 0,
        col: span.column_start ?? 0,
        severity: m.level === "error" ? "error" : "warning",
        message: m.message ?? "",
        source: "cargo",
      });
    }
  } catch {}
  return diagnostics;
}

function parseClippyOutput(raw: string, workspacePath: string): Diagnostic[] {
  return parseCargoOutput(raw, workspacePath).map((d) => ({ ...d, source: "clippy" }));
}

function parseGoVetOutput(raw: string, workspacePath: string): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  for (const line of raw.split("\n")) {
    const match = line.match(/^(.+?):(\d+)(?::(\d+))?:\s+(.+)$/);
    if (match) {
      diagnostics.push({
        file: path.relative(workspacePath, match[1]),
        line: parseInt(match[2], 10),
        col: match[3] ? parseInt(match[3], 10) : 1,
        severity: "error",
        message: match[4].trim(),
        source: "go vet",
      });
    }
  }
  return diagnostics;
}

function parseGolangciLintOutput(raw: string, workspacePath: string): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  for (const line of raw.split("\n")) {
    const match = line.match(/^(.+?):(\d+):(\d+):\s+(.+?)(?:\s+\((\w+)\))?$/);
    if (match) {
      diagnostics.push({
        file: path.relative(workspacePath, match[1]),
        line: parseInt(match[2], 10),
        col: parseInt(match[3], 10),
        severity: "warning",
        message: match[4].trim(),
        source: "golangci-lint",
      });
    }
  }
  return diagnostics;
}

function parseBiomeOutput(raw: string, workspacePath: string): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  try {
    const items = JSON.parse(raw);
    if (Array.isArray(items)) {
      for (const item of items) {
        const file = item.path ?? item.file ?? "unknown";
        const span = item.span ?? item.location ?? {};
        const line = span.start?.line ?? item.line ?? 0;
        const col = span.start?.character ?? span.start?.column ?? item.column ?? 0;
        const severity = item.severity === "error" || item.severity === "fatal" ? "error" : "warning";
        const code = item.category ?? item.code ?? "";
        const msg = item.message ?? item.description ?? "";
        diagnostics.push({
          file: path.relative(workspacePath, file),
          line,
          col,
          severity,
          message: code ? `${code}: ${msg}` : msg,
          source: "biome",
        });
      }
    }
  } catch {
    for (const line of raw.split("\n")) {
      const match = line.match(/^(.+?):(\d+):(\d+)\s+(lint\/\S+|parse)\s+━+/);
      if (match) {
        diagnostics.push({
          file: path.relative(workspacePath, match[1]),
          line: parseInt(match[2], 10),
          col: parseInt(match[3], 10),
          severity: "error",
          message: match[4],
          source: "biome",
        });
      }
      const simpleMatch = line.match(/^(.+?):(\d+):(\d+):\s+(.+)$/);
      if (!match && simpleMatch) {
        diagnostics.push({
          file: path.relative(workspacePath, simpleMatch[1]),
          line: parseInt(simpleMatch[2], 10),
          col: parseInt(simpleMatch[3], 10),
          severity: "error",
          message: simpleMatch[4].trim(),
          source: "biome",
        });
      }
    }
  }
  return diagnostics;
}

function parseRubocopJson(raw: string, workspacePath: string): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  try {
    const result = JSON.parse(raw);
    if (result.files && Array.isArray(result.files)) {
      for (const file of result.files) {
        for (const offense of file.offenses ?? []) {
          diagnostics.push({
            file: path.relative(workspacePath, file.path),
            line: offense.location?.start_line ?? 0,
            col: offense.location?.start_column ?? 0,
            severity: offense.severity === "error" || offense.severity === "fatal" ? "error" : "warning",
            message: `${offense.cop_name}: ${offense.message}`,
            source: "rubocop",
          });
        }
      }
    }
  } catch {}
  return diagnostics;
}

function parseXcodebuildOutput(raw: string, workspacePath: string): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  for (const line of raw.split("\n")) {
    // Match error/warning patterns like:
    // /path/to/file.swift:10:15: error: message
    // /path/to/file.swift:10:15: warning: message
    const match = line.match(/^(.+?):(\d+):(\d+):\s*(error|warning):\s*(.+)$/);
    if (match) {
      diagnostics.push({
        file: path.relative(workspacePath, match[1]),
        line: parseInt(match[2], 10),
        col: parseInt(match[3], 10),
        severity: match[4] as "error" | "warning",
        message: match[5].trim(),
        source: "xcodebuild",
      });
    }
  }
  return diagnostics;
}

function parseSwiftBuildOutput(raw: string, workspacePath: string): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  for (const line of raw.split("\n")) {
    // Match Swift compiler output:
    // /path/to/file.swift:10:15: error: message
    // /path/to/file.swift:10:15: warning: message
    const match = line.match(/^(.+?):(\d+):(\d+):\s*(error|warning):\s*(.+)$/);
    if (match) {
      diagnostics.push({
        file: path.relative(workspacePath, match[1]),
        line: parseInt(match[2], 10),
        col: parseInt(match[3], 10),
        severity: match[4] as "error" | "warning",
        message: match[5].trim(),
        source: "swift build",
      });
    }
  }
  return diagnostics;
}

// --- Linter specs ---

const linters: LinterSpec[] = [
  {
    id: "tsc",
    label: "TypeScript (tsc)",
    configFiles: ["tsconfig.json"],
    buildCommand: () => ({ cmd: "npx", args: ["tsc", "--noEmit", "--pretty", "false"] }),
    parse: (stdout, stderr, wp) => parseTscOutput(stdout + "\n" + stderr, wp),
  },
  {
    id: "eslint",
    label: "ESLint",
    configFiles: ["eslint.config.js", "eslint.config.mjs", "eslint.config.ts", "eslint.config.cjs", ".eslintrc.json", ".eslintrc.js", ".eslintrc.cjs", ".eslintrc.yml", ".eslintrc.yaml", ".eslintrc"],
    buildCommand: (paths) => ({
      cmd: "npx",
      args: ["eslint", "--format", "compact", "--no-error-on-unmatched-pattern", ...(paths.length ? paths : ["."])],
    }),
    parse: (stdout, stderr, wp) => parseEslintCompact(stdout + "\n" + stderr, wp),
  },
  {
    id: "biome",
    label: "Biome",
    configFiles: ["biome.json", "biome.jsonc"],
    buildCommand: (paths) => ({
      cmd: "npx",
      args: ["@biomejs/biome", "lint", "--reporter=json", ...(paths.length ? paths : ["."])],
    }),
    parse: (stdout, stderr, wp) => parseBiomeOutput(stdout || stderr, wp),
  },
  {
    id: "ruff",
    label: "Ruff (Python)",
    configFiles: ["ruff.toml", ".ruff.toml", "pyproject.toml"],
    markerFiles: ["pyproject.toml", "setup.py", "setup.cfg", "requirements.txt", "Pipfile"],
    fileExtensions: [".py"],
    buildCommand: (paths) => ({
      cmd: "ruff",
      args: ["check", "--output-format", "text", ...(paths.length ? paths : ["."])],
    }),
    parse: (stdout, stderr, wp) => parseRuffOutput(stdout + "\n" + stderr, wp),
  },
  {
    id: "flake8",
    label: "Flake8 (Python)",
    configFiles: [".flake8", "setup.cfg", "tox.ini"],
    markerFiles: ["pyproject.toml", "setup.py", "setup.cfg", "requirements.txt", "Pipfile"],
    fileExtensions: [".py"],
    buildCommand: (paths) => ({
      cmd: "flake8",
      args: [...(paths.length ? paths : ["."])],
    }),
    parse: (stdout, stderr, wp) => parseFlaке8Output(stdout + "\n" + stderr, wp),
  },
  {
    id: "pylint",
    label: "Pylint (Python)",
    configFiles: [".pylintrc", "pylintrc", "pyproject.toml"],
    markerFiles: ["pyproject.toml", "setup.py", "requirements.txt"],
    fileExtensions: [".py"],
    buildCommand: (paths) => ({
      cmd: "pylint",
      args: ["--output-format=json", ...(paths.length ? paths : ["."])],
    }),
    parse: (stdout, _stderr, wp) => parsePylintJson(stdout, wp),
  },
  {
    id: "mypy",
    label: "Mypy (Python)",
    configFiles: ["mypy.ini", ".mypy.ini"],
    markerFiles: ["pyproject.toml", "setup.py"],
    fileExtensions: [".py"],
    buildCommand: (paths) => ({
      cmd: "mypy",
      args: [...(paths.length ? paths : ["."])],
    }),
    parse: (stdout, stderr, wp) => parseMypyOutput(stdout + "\n" + stderr, wp),
  },
  {
    id: "cargo-check",
    label: "Cargo Check (Rust)",
    configFiles: ["Cargo.toml"],
    fileExtensions: [".rs"],
    buildCommand: () => ({
      cmd: "cargo",
      args: ["check", "--message-format=json", "--quiet"],
    }),
    parse: (stdout, _stderr, wp) => parseCargoOutput(stdout, wp),
  },
  {
    id: "clippy",
    label: "Clippy (Rust)",
    configFiles: ["Cargo.toml"],
    fileExtensions: [".rs"],
    buildCommand: () => ({
      cmd: "cargo",
      args: ["clippy", "--message-format=json", "--quiet", "--", "-W", "clippy::all"],
    }),
    parse: (stdout, _stderr, wp) => parseClippyOutput(stdout, wp),
  },
  {
    id: "go-vet",
    label: "Go Vet",
    configFiles: ["go.mod"],
    fileExtensions: [".go"],
    buildCommand: (paths) => ({
      cmd: "go",
      args: ["vet", ...(paths.length ? paths : ["./..."])],
    }),
    parse: (_stdout, stderr, wp) => parseGoVetOutput(stderr, wp),
  },
  {
    id: "golangci-lint",
    label: "golangci-lint (Go)",
    configFiles: [".golangci.yml", ".golangci.yaml", ".golangci.json", ".golangci.toml"],
    markerFiles: ["go.mod"],
    fileExtensions: [".go"],
    buildCommand: (paths) => ({
      cmd: "golangci-lint",
      args: ["run", "--out-format", "line-number", ...(paths.length ? paths : [])],
    }),
    parse: (stdout, stderr, wp) => parseGolangciLintOutput(stdout + "\n" + stderr, wp),
  },
  {
    id: "rubocop",
    label: "RuboCop (Ruby)",
    configFiles: [".rubocop.yml"],
    markerFiles: ["Gemfile", "Rakefile"],
    fileExtensions: [".rb"],
    buildCommand: (paths) => ({
      cmd: "rubocop",
      args: ["--format", "json", ...(paths.length ? paths : [])],
    }),
    parse: (stdout, _stderr, wp) => parseRubocopJson(stdout, wp),
  },
  {
    id: "swift-build",
    label: "Swift Build",
    configFiles: ["Package.swift"],
    markerFiles: [],
    fileExtensions: [".swift"],
    buildCommand: () => ({
      cmd: "swift",
      args: ["build"],
    }),
    parse: (stdout, stderr, wp) => parseSwiftBuildOutput(stdout + "\n" + stderr, wp),
  },
  {
    id: "xcodebuild",
    label: "Xcode Build",
    configFiles: [],
    markerFiles: [".xcodeproj", ".xcworkspace"],
    buildCommand: () => ({
      cmd: "xcodebuild",
      args: ["build", "-quiet"],
    }),
    parse: (stdout, stderr, wp) => parseXcodebuildOutput(stdout + "\n" + stderr, wp),
  },
];

async function detectLinters(workspacePath: string): Promise<LinterSpec[]> {
  const detected: LinterSpec[] = [];
  const pythonLinterPriority = ["ruff", "flake8", "pylint"];
  let pythonLinterFound = false;
  const rustLinterPriority = ["clippy", "cargo-check"];
  let rustLinterFound = false;
  const goLinterPriority = ["golangci-lint", "go-vet"];
  let goLinterFound = false;
  const swiftLinterPriority = ["swift-build", "xcodebuild"];
  let swiftLinterFound = false;

  for (const linter of linters) {
    const hasConfig = await anyFileExists(workspacePath, linter.configFiles);

    if (!hasConfig && linter.markerFiles) {
      const hasMarker = await anyFileExists(workspacePath, linter.markerFiles);
      if (!hasMarker) continue;
    }

    if (!hasConfig && !linter.markerFiles) continue;

    if (pythonLinterPriority.includes(linter.id)) {
      if (pythonLinterFound) continue;
      if (hasConfig || (await commandExists(linter.id === "cargo-check" ? "cargo" : linter.id))) {
        pythonLinterFound = true;
      } else {
        continue;
      }
    }

    if (rustLinterPriority.includes(linter.id)) {
      if (rustLinterFound) continue;
      if (hasConfig || (await commandExists("cargo"))) {
        rustLinterFound = true;
      } else {
        continue;
      }
    }

    if (goLinterPriority.includes(linter.id)) {
      if (goLinterFound) continue;
      const cmdName = linter.id === "go-vet" ? "go" : linter.id;
      if (hasConfig || (await commandExists(cmdName))) {
        goLinterFound = true;
      } else {
        continue;
      }
    }

    if (swiftLinterPriority.includes(linter.id)) {
      if (swiftLinterFound) continue;

      if (linter.id === "swift-build") {
        // Package.swift check is already done via hasConfig
        if (hasConfig && (await commandExists("swift"))) {
          swiftLinterFound = true;
        } else {
          continue;
        }
      } else if (linter.id === "xcodebuild") {
        const { hasProject, hasWorkspace } = await hasXcodeProject(workspacePath);
        if ((hasProject || hasWorkspace) && (await commandExists("xcodebuild"))) {
          swiftLinterFound = true;
        } else {
          continue;
        }
      }
    }

    detected.push(linter);
  }

  return detected;
}

function formatDiagnostics(diagnostics: Diagnostic[], tools: string[]): string {
  if (diagnostics.length === 0) return `Linters ran: ${tools.join(", ")}.\nNo errors or warnings found.`;

  const grouped = new Map<string, Diagnostic[]>();
  for (const d of diagnostics) {
    const list = grouped.get(d.file) ?? [];
    list.push(d);
    grouped.set(d.file, list);
  }

  const errors = diagnostics.filter((d) => d.severity === "error").length;
  const warnings = diagnostics.filter((d) => d.severity === "warning").length;

  const lines: string[] = [];
  lines.push(`Linters ran: ${tools.join(", ")}`);
  lines.push(`Found ${diagnostics.length} diagnostic(s): ${errors} error(s), ${warnings} warning(s)\n`);

  for (const [file, diags] of grouped) {
    lines.push(`${file}:`);
    for (const d of diags) {
      const sev = d.severity === "error" ? "ERROR" : "WARN";
      const src = d.source ? `[${d.source}] ` : "";
      lines.push(`  ${d.line}:${d.col} ${sev} ${src}${d.message}`);
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
  description: `Run project linters/type-checkers and return errors/warnings. Auto-detects the project type and available tools (TypeScript, ESLint, Biome, Ruff, Flake8, Pylint, Mypy, Cargo/Clippy, Go Vet, golangci-lint, RuboCop, Xcode Build, Swift Build). Use after edits to verify correctness.`,
  parameters: readLintsParameters,
  async execute(args, ctx): Promise<ToolResult> {
    const workspacePath = ctx.workspacePath;
    let allDiagnostics: Diagnostic[] = [];
    const toolsRan: string[] = [];
    const errors: string[] = [];

    const detected = await detectLinters(workspacePath);

    if (detected.length === 0) {
      return {
        title: "Lints",
        output: "No linting tools detected. Ensure the workspace has a supported project configuration (tsconfig.json, eslint config, biome.json, pyproject.toml, Cargo.toml, go.mod, Gemfile, Package.swift, .xcodeproj, etc.).",
        metadata: { diagnosticCount: 0, tools: [] },
      };
    }

    for (const linter of detected) {
      try {
        const { cmd, args: cmdArgs } = linter.buildCommand(args.paths ?? [], workspacePath);
        const { stdout, stderr } = await runCommand(cmd, cmdArgs, workspacePath);
        const parsed = linter.parse(stdout, stderr, workspacePath);
        allDiagnostics.push(...parsed);
        toolsRan.push(linter.label);
      } catch (e) {
        errors.push(`${linter.label}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    if (args.paths?.length) {
      const filterPaths = new Set(
        args.paths.map((p: string) => (path.isAbsolute(p) ? path.relative(workspacePath, p) : p)),
      );
      allDiagnostics = allDiagnostics.filter((d) => filterPaths.has(d.file));
    }

    let output = formatDiagnostics(allDiagnostics, toolsRan);
    if (errors.length > 0) {
      output += `\n\nLinter errors:\n${errors.join("\n")}`;
    }

    return {
      title: "Lints",
      output: truncateOutput(output),
      metadata: {
        diagnosticCount: allDiagnostics.length,
        errors: allDiagnostics.filter((d) => d.severity === "error").length,
        warnings: allDiagnostics.filter((d) => d.severity === "warning").length,
        tools: toolsRan,
        diagnostics: allDiagnostics.slice(0, 50),
      },
    };
  },
};

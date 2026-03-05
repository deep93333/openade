import os from "os";
import * as fs from "fs/promises";
import * as path from "path";
import type { AgentMode } from "@agentide/shared";

const PROJECT_MARKERS = [
  "package.json",
  "Cargo.toml",
  "go.mod",
  "pyproject.toml",
  "requirements.txt",
  "Gemfile",
  "pom.xml",
  "build.gradle",
  "CMakeLists.txt",
  "Makefile",
  "docker-compose.yml",
  "Dockerfile",
  ".gitignore",
];

const IGNORE_DIRS = new Set([
  "node_modules", ".git", ".next", ".turbo", "dist", "build", "out",
  "__pycache__", ".venv", "venv", "target", ".cache", ".idea", ".vscode",
  "coverage", ".nyc_output", ".parcel-cache", ".svelte-kit",
]);

async function getShallowTree(dir: string, depth = 2, prefix = ""): Promise<string[]> {
  if (depth <= 0) return [];
  const lines: string[] = [];
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const sorted = entries
      .filter((e) => !e.name.startsWith(".") || e.name === ".env.example")
      .sort((a, b) => {
        if (a.isDirectory() && !b.isDirectory()) return -1;
        if (!a.isDirectory() && b.isDirectory()) return 1;
        return a.name.localeCompare(b.name);
      });

    for (const entry of sorted) {
      if (entry.isDirectory()) {
        if (IGNORE_DIRS.has(entry.name)) continue;
        lines.push(`${prefix}${entry.name}/`);
        const sub = await getShallowTree(path.join(dir, entry.name), depth - 1, prefix + "  ");
        lines.push(...sub);
      } else {
        lines.push(`${prefix}${entry.name}`);
      }
    }
  } catch {}
  return lines;
}

async function readProjectFile(dir: string, filename: string, maxLines = 20): Promise<string | null> {
  try {
    const filepath = path.join(dir, filename);
    const content = await fs.readFile(filepath, "utf-8");
    const lines = content.split("\n");
    if (lines.length <= maxLines) return content.trim();
    return lines.slice(0, maxLines).join("\n") + `\n... (${lines.length} total lines)`;
  } catch {
    return null;
  }
}

async function detectProjectContext(workspacePath: string): Promise<string> {
  const sections: string[] = [];

  const tree = await getShallowTree(workspacePath, 2);
  if (tree.length > 0) {
    const maxTreeLines = 40;
    const truncated = tree.length > maxTreeLines;
    const display = truncated ? tree.slice(0, maxTreeLines) : tree;
    sections.push(
      "### Project Structure",
      "```",
      ...display,
      truncated ? `... (${tree.length} total entries)` : "",
      "```",
    );
  }

  for (const marker of PROJECT_MARKERS) {
    const content = await readProjectFile(workspacePath, marker);
    if (content) {
      sections.push(`### ${marker}`, "```", content, "```");
      break;
    }
  }

  const readme = await readProjectFile(workspacePath, "README.md", 20);
  if (readme) {
    sections.push("### README.md (excerpt)", readme);
  }

  return sections.filter(Boolean).join("\n");
}

function buildEnvironmentSection(workspacePath: string): string {
  const platform = os.platform();
  const arch = os.arch();
  const homeDir = os.homedir();
  const shell = process.env.SHELL || (platform === "win32" ? "cmd.exe" : "/bin/bash");
  return `## Environment
- OS: ${platform} ${arch}
- Shell: ${shell}
- Home: ${homeDir}
- Working directory: ${workspacePath}
- Current date: ${new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}`;
}

function buildAgentModePrompt(envSection: string, projectSection: string): string {
  return `You are an expert AI coding assistant working in the user's project.

${envSection}
${projectSection}
## Guidelines

### Tool Efficiency — CRITICAL
Minimize tool calls and output size. Every call costs time and tokens.
- **NEVER use bash for text search or file finding.** Use 'grep' for content search and 'glob' for finding files. Both tools automatically exclude node_modules, dist, build, .git, and other output directories.
- **Search before reading:** Use grep/glob to find the right files first, then read only those files (or specific sections with offset/limit). Do NOT read files speculatively.
- **Use project context above:** The project structure, manifest, and README are already provided. Do not re-read them.
- **One read per edit:** Read a file once, then edit. Do NOT re-read after editing unless you need to verify complex changes.
- **Batch related searches:** If you need to find a type definition and its usages, use one grep with a broad enough pattern rather than multiple separate searches.
- **Targeted reads:** When reading files, default to offset/limit of ~100 lines around the area of interest. Only read entire files when they are small (<150 lines) or you truly need full context.
- **Skip todowrite for simple tasks:** Only use todowrite for tasks with 3+ distinct steps. For 1-2 step tasks, just do the work directly.

### Tool Reference
- **grep:** Search file contents with regex. Supports 'include' for file type filtering (e.g. '*.ts'). Auto-excludes build/output dirs.
- **glob:** Find files by pattern. Supports recursive '**' patterns (e.g. '**/*.tsx', 'src/**/*.test.ts'). Auto-excludes build/output dirs.
- **read:** Read file contents. Use 'offset' and 'limit' params for large files. Do NOT use bash 'cat' or 'head'.
- **bash:** For git, installs, builds, running scripts. NOT for searching or reading files.
- **readlints:** Check for lint/type errors after edits. Prefer this over running tsc/eslint via bash.
- **delegate:** Run read-only sub-agents in parallel. Each sub-agent explores the codebase independently and returns a summary.

### Code Quality
- Write clean, well-organized code following the project's existing patterns
- Use types instead of interfaces in TypeScript
- Do NOT add comments that just narrate what the code does
- Only comment non-obvious intent, trade-offs, or constraints

### Workflow
- Read relevant files before editing to understand context
- Make changes incrementally
- After edits, use readlints to check for errors
- If you encounter errors, read the error carefully and fix it
- Use ask_question when you need structured input from the user (e.g., choosing between approaches). The user can always type a custom answer, so include an "Other" option only if you want to explicitly label that path.

### Communication
- Be concise and direct
- Focus on the "why" not the "what"
- If a task is ambiguous, use ask_question to present options rather than guessing

### File Operations
- Always use absolute paths
- Use 'edit' for surgical changes, 'write' only for new files or complete rewrites

### Bash Commands
- Only use bash for git operations, package installs, builds, running scripts, and other system commands
- Provide clear descriptions for every command
- Set appropriate timeouts for long-running commands

### Delegate (Sub-Agents)
- Use the **delegate** tool to run multiple read-only research tasks in parallel
- Each sub-agent gets its own context with read, grep, glob, ls, and readlints tools
- Sub-agents CANNOT modify files — they only explore and report back
- Use delegate when you need to explore multiple unrelated areas of the codebase simultaneously (e.g., "understand auth flow" + "find all test files" + "check API routes")
- Each task should be self-contained with a clear prompt describing what to find
- After receiving sub-agent results, you make all edits yourself
- Do NOT use delegate for a single task — just do it directly
- Maximum 5 concurrent sub-agent tasks per delegate call`;
}

function buildPlanModePrompt(envSection: string, projectSection: string): string {
  return `You are an expert software architect and planning assistant.

${envSection}
${projectSection}
## Your Role
You are in **Plan mode**. Your job is to analyze the user's request and produce a structured implementation plan. You have access to **read-only tools** to explore the codebase — use them to understand the existing code before planning.

### Available Tools (read-only)
- **read:** Read file contents. Use 'offset' and 'limit' params for large files.
- **grep:** Search file contents with regex. Supports 'include' for file type filtering.
- **glob:** Find files by pattern. Supports recursive '**' patterns.
- **ls:** List directory contents.
- **readlints:** Check for lint/type errors.

You CANNOT modify, write, edit, or delete any files.

### Workflow
1. Use the read-only tools to explore relevant files and understand the codebase
2. Once you have enough context, produce a structured plan

## Output Format
After exploring the codebase, produce your plan in this markdown structure:

# Plan: <concise title>

## Goal
<1-2 sentences describing what the user wants to achieve>

## Steps

### 1. <action> \`<file path>\`
- <specific change description>
- <specific change description>

### 2. <action> \`<file path>\`
- <specific change description>

_(continue for all steps)_

## Files Affected
- \`path/to/file.ts\` (new | modify | delete)

## Risks & Considerations
- <anything the user should be aware of>

## Guidelines
- Search and read relevant files before planning — don't guess at implementations
- Be specific: reference actual file paths, name functions/types/components
- Order steps logically — dependencies first
- Each step should be actionable by a coding agent
- Keep it concise — no filler, no restating the user's request
- If the request is ambiguous, state your assumptions`;
}

function buildAskModePrompt(envSection: string, projectSection: string): string {
  return `You are a knowledgeable coding assistant.

${envSection}
${projectSection}
## Your Role
You are in **Ask mode**. Answer the user's questions about their codebase, programming concepts, architecture decisions, and best practices. You have access to **read-only tools** to explore the codebase — use them to find relevant code before answering.

### Available Tools (read-only)
- **read:** Read file contents. Use 'offset' and 'limit' params for large files.
- **grep:** Search file contents with regex. Supports 'include' for file type filtering.
- **glob:** Find files by pattern. Supports recursive '**' patterns.
- **ls:** List directory contents.
- **readlints:** Check for lint/type errors.

You CANNOT modify, write, edit, or delete any files.

## Guidelines
- Use the read-only tools to find and read relevant code before answering
- Be concise and direct
- Reference specific files, line numbers, and patterns from the codebase
- Provide code examples when helpful, but do not make changes
- Focus on explaining the "why" behind recommendations`;
}

function buildAgentReviewModePrompt(envSection: string, projectSection: string): string {
  return `You are an expert AI code reviewer.

${envSection}
${projectSection}
## Your Role
You are in **Agent Review mode**. Your job is to rigorously review the work done in this thread. You have access to **read-only tools** to inspect the codebase — use them to verify implementations, trace logic, and check correctness.

### Available Tools (read-only)
- **read:** Read file contents. Use 'offset' and 'limit' params for large files.
- **grep:** Search file contents with regex. Supports 'include' for file type filtering.
- **glob:** Find files by pattern. Supports recursive '**' patterns.
- **ls:** List directory contents.
- **readlints:** Check for lint/type errors.

You CANNOT modify, write, edit, or delete any files.

## Review Checklist
Work through the following systematically:

1. **Correctness** — Does the implementation do what was asked? Are there logic errors or off-by-one bugs?
2. **Completeness** — Are all required cases handled? Are there missing edge cases or untreated error paths?
3. **Type safety** — Do types align correctly? Are there any implicit \`any\` or unsafe casts?
4. **Lint & build** — Run \`readlints\` on changed files to surface type or lint errors.
5. **Consistency** — Does the code follow existing patterns in the codebase? Check neighboring files.
6. **Side effects** — Are there unintended side effects, memory leaks, or race conditions?
7. **Security** — Any injection vectors, unvalidated inputs, or exposed secrets?

## Output Format
Structure your review as:

### Summary
<1-2 sentences on what was implemented>

### Issues Found
- **[CRITICAL | WARNING | SUGGESTION]** \`file:line\` — description

### What Looks Good
- <things that are correct and well-done>

### Recommended Next Steps
- <concrete, actionable items ordered by priority>

## Guidelines
- Read the relevant changed files before reviewing — never guess
- Reference specific file paths and line numbers for every issue
- Be precise and actionable — no vague feedback
- If nothing needs fixing, say so clearly`;
}

export async function buildSystemPrompt(workspacePath: string, mode: AgentMode = "agent"): Promise<string> {
  let projectContext = "";
  try {
    projectContext = await detectProjectContext(workspacePath);
  } catch {}

  const envSection = buildEnvironmentSection(workspacePath);
  const projectSection = projectContext
    ? `\n## Project Context\n${projectContext}\n`
    : "";

  switch (mode) {
    case "plan":
      return buildPlanModePrompt(envSection, projectSection);
    case "ask":
      return buildAskModePrompt(envSection, projectSection);
    case "agent_review":
      return buildAgentReviewModePrompt(envSection, projectSection);
    default:
      return buildAgentModePrompt(envSection, projectSection);
  }
}

export const COMPACTION_PROMPT = `Provide a detailed summary of our conversation so far for continuing the work.

Focus on:
- What the user's goal is
- What important instructions were given
- What was discovered during the conversation
- What work has been completed and what remains
- Relevant files and directories

Use this template:
---
## Goal
[What goal(s) is the user trying to accomplish?]

## Instructions
- [Important instructions from the user]

## Discoveries
[Notable things learned during the conversation]

## Accomplished
[What's done, in progress, and remaining]

## Relevant Files
[Structured list of relevant files read, edited, or created]
---`;

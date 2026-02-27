# Claude Agent SDK — Detailed Guide (TypeScript + Python)

Single reference for the **Claude Agent SDK** (formerly Claude Code SDK): autonomous agents that read files, run commands, search the web, edit code, and use tools. Same agent loop and tool runtime as Claude Code.

Sources: [Overview](https://docs.anthropic.com/en/docs/agent-sdk/overview) · [TypeScript](https://docs.anthropic.com/en/docs/agent-sdk/typescript) · [Sessions](https://docs.anthropic.com/en/docs/agent-sdk/sessions) · [Migration](https://docs.anthropic.com/en/docs/agent-sdk/migration-guide) · [MCP](https://docs.anthropic.com/en/docs/agent-sdk/mcp) · [Permissions](https://docs.anthropic.com/en/docs/agent-sdk/permissions) · [Hooks](https://docs.anthropic.com/en/docs/agent-sdk/hooks) · [Structured outputs](https://docs.anthropic.com/en/docs/agent-sdk/structured-outputs) · Context7: `/websites/platform_claude_en_agent-sdk`

---

## Table of contents

1. [Overview](#1-overview)
2. [Installation](#2-installation)
3. [Quickstart](#3-quickstart)
4. [Core API: `query()` and options](#4-core-api-query-and-options)
5. [Session management](#5-session-management)
6. [Built-in tools](#6-built-in-tools)
7. [Custom tools and MCP](#7-custom-tools-and-mcp)
8. [Permissions](#8-permissions)
9. [Hooks](#9-hooks)
10. [Sandbox](#10-sandbox)
11. [Structured output](#11-structured-output)
12. [Message types and `Query` methods](#12-message-types-and-query-methods)
13. [Migration from Claude Code SDK](#13-migration-from-claude-code-sdk)
14. [References](#14-references)

---

## 1. Overview

**What it is:** Library for production agents: Read/Write/Edit files, Bash, Glob, Grep, WebSearch, WebFetch, AskUserQuestion, custom tools via MCP. **Languages:** TypeScript (Node/Bun/Deno), Python.

**Flow:** Call `query(prompt, options)` and iterate messages: `system:init` → `assistant` (tool proposals) → tool execution → … → `result` (outcome, usage, cost, optional `structured_output`).

---

## 2. Installation

**TypeScript**

```bash
npm install @anthropic-ai/claude-agent-sdk
```

Set API key: `export ANTHROPIC_API_KEY=your-api-key`

**Python:** `pip install claude-agent-sdk` (same env var).

---

## 3. Quickstart

**TypeScript**

```typescript
import { query } from "@anthropic-ai/claude-agent-sdk";

for await (const message of query({
  prompt: "Find and fix the bug in auth.py",
  options: { allowedTools: ["Read", "Edit", "Bash"] }
})) {
  console.log(message);
}
```

Pattern: restrict tools; optional `permissionMode: "acceptEdits"`; handle `type === "assistant"` and `type === "result"`.

---

## 4. Core API: `query()` and options

### `query()`

```typescript
function query({
  prompt,
  options
}: {
  prompt: string | AsyncIterable<SDKUserMessage>;
  options?: Options;
}): Query
```

- `prompt`: initial user message (string) or async iterable for streaming/multi-turn.
- `options`: optional config (see below).
- Returns: `Query` = `AsyncGenerator<SDKMessage, void>` with `close()`, `rewindFiles()`, `setPermissionMode()`, etc.

### Options

| Option | Type | Default | Description |
|--------|------|--------|-------------|
| `cwd` | `string` | `process.cwd()` | Working directory for the session. |
| `model` | `string` | CLI default | Claude model (e.g. `claude-opus-4-6`). |
| `allowedTools` | `string[]` | All tools | Tool names the agent may use. |
| `disallowedTools` | `string[]` | `[]` | Tool names to forbid. |
| `tools` | `string[]` or `{ type: 'preset'; preset: 'claude_code' }` | `undefined` | Explicit tool set or Claude Code preset. |
| `permissionMode` | `PermissionMode` | `'default'` | `'default'`, `'acceptEdits'`, `'bypassPermissions'`, `'plan'`, `'dontAsk'`. |
| `canUseTool` | `CanUseTool` | `undefined` | Custom async (toolName, input, meta) => PermissionResult. |
| `mcpServers` | `Record<string, McpServerConfig>` | `{}` | MCP servers (stdio, http, sse, sdk). |
| `resume` | `string` | `undefined` | Session ID to resume. |
| `persistSession` | `boolean` | `true` | Whether to persist session to disk. |
| `maxTurns` | `number` | `undefined` | Max conversation turns. |
| `maxBudgetUsd` | `number` | `undefined` | Max spend in USD. |
| `systemPrompt` | `string` or `{ type: 'preset'; preset: 'claude_code'; append?: string }` | minimal | System prompt or preset + optional append. |
| `settingSources` | `('user' \| 'project' \| 'local')[]` | `[]` | Load settings; use `['project']` for CLAUDE.md. |
| `sandbox` | `SandboxSettings` | `undefined` | Sandbox for command execution and network. |
| `outputFormat` | `{ type: 'json_schema'; schema: JSONSchema }` | `undefined` | Structured output schema. |
| `hooks` | `Partial<Record<HookEvent, HookCallbackMatcher[]>>` | `{}` | PreToolUse, PostToolUse, etc. |
| `effort` | `'low' \| 'medium' \| 'high' \| 'max'` | `'high'` | Effort level (adaptive thinking). |
| `thinking` | `ThinkingConfig` | `{ type: 'adaptive' }` | adaptive / enabled / disabled. |
| `agents` | `Record<string, AgentDefinition>` | `undefined` | Subagents. |
| `abortController` | `AbortController` | new AbortController() | Cancel the run. |

Python: snake_case (`allowed_tools`, `permission_mode`, `mcp_servers`, …). Full types: [TypeScript API reference](https://docs.anthropic.com/en/docs/agent-sdk/typescript).

---

## 5. Session management

- Sessions are created when you start a `query`. First message is `type: "system"`, `subtype: "init"`, and includes `session_id`.
- Use `resume` with that session ID to continue (full context). `persistSession: false` → no disk, no resume. Optional: `forkSession` to branch work.

### Getting and resuming session ID (TypeScript)

```typescript
import { query } from "@anthropic-ai/claude-agent-sdk";

let sessionId: string | undefined;

for await (const message of query({
  prompt: "Help me build a web application",
  options: { model: "claude-opus-4-6" }
})) {
  if (message.type === "system" && message.subtype === "init") {
    sessionId = message.session_id;
    console.log(`Session started: ${sessionId}`);
  }
  console.log(message);
}

if (sessionId) {
  for await (const message of query({
    prompt: "Continue where we left off",
    options: { resume: sessionId }
  })) {
    if ("result" in message) console.log(message.result);
  }
}
```

### `listSessions()` (TypeScript)

```typescript
import { listSessions } from "@anthropic-ai/claude-agent-sdk";

const sessions = await listSessions({ dir: "/path/to/project" });
const recent = await listSessions({ limit: 10 });

for (const session of sessions) {
  console.log(`${session.summary} (${new Date(session.lastModified).toLocaleDateString()})`);
}
```

`SDKSessionInfo`: `sessionId`, `summary`, `lastModified`, `fileSize`, `customTitle`, `firstPrompt`, `gitBranch`, `cwd`.

---

## 6. Built-in tools

Example sets: read-only `["Read", "Glob", "Grep"]`; full `["Read", "Edit", "Write", "Bash", "Glob", "Grep"]`.

| Tool | Purpose |
|------|--------|
| **Read** | Read files (text, images, PDFs, notebooks). `file_path`, optional `offset`, `limit`, `pages` (PDF). |
| **Write** | Overwrite file: `file_path`, `content`. |
| **Edit** | String replace: `file_path`, `old_string`, `new_string`, optional `replace_all`. |
| **Bash** | Run shell: `command`, optional `timeout`, `description`, `run_in_background`, `dangerouslyDisableSandbox`. |
| **Glob** | Match files: `pattern`, optional `path`. |
| **Grep** | Ripgrep: `pattern`, optional `path`, `glob`, `type`, `output_mode` (`content` \| `files_with_matches` \| `count`), `-i`/`-n`/`-B`/`-A`/`-C`, `head_limit`, `multiline`. |
| **WebSearch** | Web search: `query`, optional `allowed_domains`, `blocked_domains`. |
| **WebFetch** | Fetch URL and process: `url`, `prompt`. |
| **AskUserQuestion** | Ask user multiple-choice questions. |
| **Task** | Launch subagent (description, prompt, subagent_type, model, resume, run_in_background, max_turns, etc.). |
| **TodoWrite** | Task list for the agent. |
| **NotebookEdit** | Edit Jupyter notebook cells. |
| **Config** | Get/set config. |
| **EnterWorktree** | Create/enter git worktree. |
| MCP tools | `ListMcpResources`, `ReadMcpResource`, etc. |

---

## 7. Custom tools and MCP

Use `tool()` and `createSdkMcpServer()` to define type-safe tools and expose them as MCP in the same process. Tool names: `mcp__<serverName>__<toolName>`; allow all tools with `mcp__serverName__*`. Server configs: stdio (command+args), http, sse, sdk.

### TypeScript: in-process MCP server with custom tool

```typescript
import { query, tool, createSdkMcpServer } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";

const customServer = createSdkMcpServer({
  name: "my-custom-tools",
  version: "1.0.0",
  tools: [
    tool(
      "get_weather",
      "Get current temperature for a location using coordinates",
      {
        latitude: z.number().describe("Latitude coordinate"),
        longitude: z.number().describe("Longitude coordinate")
      },
      async (args) => {
        const res = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${args.latitude}&longitude=${args.longitude}&current=temperature_2m&temperature_unit=fahrenheit`
        );
        const data = await res.json();
        return {
          content: [{ type: "text", text: `Temperature: ${data.current.temperature_2m}°F` }]
        };
      }
    )
  ]
});

for await (const message of query({
  prompt: "What's the weather in San Francisco?",
  options: {
    mcpServers: { "my-custom-tools": customServer },
    allowedTools: ["mcp__my-custom-tools__get_weather"],
    maxTurns: 3
  }
})) {
  if (message.type === "result" && message.subtype === "success") {
    console.log(message.result);
  }
}
```

---

## 8. Permissions

**permissionMode:** `default` (prompts), `acceptEdits`, `bypassPermissions`, `plan`, `dontAsk`.

**canUseTool:** Custom async `(toolName, input, { signal, suggestions, blockedPath, decisionReason, toolUseID, agentID }) => Promise<PermissionResult>`.

- Return `{ behavior: "allow", updatedInput?, updatedPermissions? }` or `{ behavior: "deny", message, interrupt? }`.
- Use for: allowlists, audit logs, approval for unsandboxed Bash, blocking sensitive files (e.g. `.env`).

---

## 9. Hooks

Events: PreToolUse, PostToolUse, PostToolUseFailure, UserPromptSubmit, SessionStart/End, Stop, SubagentStart/Stop, PreCompact, PermissionRequest, Setup, TeammateIdle, TaskCompleted, ConfigChange, WorktreeCreate/Remove. Use `matcher` to target tools (e.g. `"Write|Edit"`).

### PreToolUse: block editing `.env` (TypeScript)

```typescript
import { query, HookCallback, PreToolUseHookInput } from "@anthropic-ai/claude-agent-sdk";

const protectEnvFiles: HookCallback = async (input, toolUseID, { signal }) => {
  const preInput = input as PreToolUseHookInput;
  const filePath = preInput.tool_input?.file_path as string;
  const fileName = filePath?.split("/").pop();
  if (fileName === ".env") {
    return {
      hookSpecificOutput: {
        hookEventName: input.hook_event_name,
        permissionDecision: "deny",
        permissionDecisionReason: "Cannot modify .env files"
      }
    };
  }
  return {};
};

for await (const message of query({
  prompt: "Update the database configuration",
  options: {
    hooks: {
      PreToolUse: [{ matcher: "Write|Edit", hooks: [protectEnvFiles] }]
    }
  }
})) {
  console.log(message);
}
```

---

## 10. Sandbox

Sandbox settings control command execution and network for Bash. Filesystem/network allow/deny can also use permission rules.

### TypeScript example

```typescript
import { query } from "@anthropic-ai/claude-agent-sdk";

for await (const message of query({
  prompt: "Build and test my project",
  options: {
    sandbox: {
      enabled: true,
      autoAllowBashIfSandboxed: true,
      network: { allowLocalBinding: true }
    }
  }
})) {
  if ("result" in message) console.log(message.result);
}
```

Options: `enabled`, `autoAllowBashIfSandboxed`, `excludedCommands` (e.g. `['docker']`), `allowUnsandboxedCommands` (model can set `dangerouslyDisableSandbox` → then `canUseTool`); `network`: allowedDomains, allowLocalBinding, allowUnixSockets, proxies; `filesystem`: allowWrite, denyWrite, denyRead. Avoid broad unix socket access (e.g. Docker socket).

---

## 11. Structured output

Ask the agent to return JSON conforming to a JSON Schema; read `message.structured_output` from the result message.

### TypeScript: JSON Schema

```typescript
import { query } from "@anthropic-ai/claude-agent-sdk";

const schema = {
  type: "object",
  properties: {
    company_name: { type: "string" },
    founded_year: { type: "number" },
    headquarters: { type: "string" }
  },
  required: ["company_name"]
};

for await (const message of query({
  prompt: "Research Anthropic and provide key company information",
  options: { outputFormat: { type: "json_schema", schema } }
})) {
  if (message.type === "result" && message.structured_output) {
    console.log(message.structured_output);
  }
}
```

### TypeScript: Zod schema + validation

```typescript
const FeaturePlan = z.object({
  feature_name: z.string(),
  summary: z.string(),
  steps: z.array(z.object({
    step_number: z.number(),
    description: z.string(),
    estimated_complexity: z.enum(["low", "medium", "high"])
  })),
  risks: z.array(z.string())
});
const schema = z.toJSONSchema(FeaturePlan);
// options.outputFormat = { type: "json_schema", schema }
// then: FeaturePlan.safeParse(message.structured_output)
```

---

## 12. Message types and `Query` methods

**Message types:** `assistant` (text + tool_use), `user`, `result` (result, structured_output?, usage, total_cost_usd), `system` (init, status, task/hook/compact), `stream_event` (if includePartialMessages), tool_progress, auth_status, rate_limit_event, prompt_suggestion.

**Query methods:** `close()`, `initializationResult()`, `supportedCommands()`, `supportedModels()`, `mcpServerStatus()`, `accountInfo()`, `setPermissionMode(mode)`, `setModel(model)`, `streamInput(stream)`, `rewindFiles(userMessageId, { dryRun? })` (requires enableFileCheckpointing), `stopTask(taskId)`, `reconnectMcpServer(name)`, `toggleMcpServer(name, enabled)`, `setMcpServers(servers)`.

---

## 13. Migration from Claude Code SDK

1. Uninstall old packages.
2. Install: TypeScript `@anthropic-ai/claude-agent-sdk`, Python `claude-agent-sdk`.
3. Imports: Python `claude_code_sdk` → `claude_agent_sdk`; types `ClaudeCodeOptions` → `ClaudeAgentOptions`.
4. Re-run tests; verify permissions and sandbox.

---

## 14. References

- [Overview](https://docs.anthropic.com/en/docs/agent-sdk/overview)
- [Quickstart](https://docs.anthropic.com/en/docs/agent-sdk/quickstart)
- [TypeScript API](https://docs.anthropic.com/en/docs/agent-sdk/typescript)
- [Sessions](https://docs.anthropic.com/en/docs/agent-sdk/sessions)
- [Migration](https://docs.anthropic.com/en/docs/agent-sdk/migration-guide)
- [MCP](https://docs.anthropic.com/en/docs/agent-sdk/mcp) · [Custom tools](https://docs.anthropic.com/en/docs/agent-sdk/custom-tools)
- [Permissions](https://docs.anthropic.com/en/docs/agent-sdk/permissions) · [Hooks](https://docs.anthropic.com/en/docs/agent-sdk/hooks)
- [Structured outputs](https://docs.anthropic.com/en/docs/agent-sdk/structured-outputs)
- Context7: `/websites/platform_claude_en_agent-sdk`

**Tip:** Many docs URLs return Markdown with `.md`, e.g. `https://docs.anthropic.com/en/docs/agent-sdk/typescript.md`.

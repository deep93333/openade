# Codex Agent SDK — Detailed Guide (Codex SDK + MCP + App Server)

Single reference for **programmatically controlling Codex** (OpenAI’s coding agent) in your own tools and workflows—via the **Codex SDK** (TypeScript), **Codex as an MCP server**, and **Codex app-server**. ([Codex docs](https://developers.openai.com/codex))

---

## Table of contents

1. [Overview](#1-overview)
2. [Installation](#2-installation)
3. [Quickstart](#3-quickstart)
4. [Core API: Codex, Thread, and Turn](#4-core-api-codex-thread-and-turn)
5. [Thread/session management](#5-threadsession-management)
6. [Streaming + events](#6-streaming--events)
7. [Structured output](#7-structured-output)
8. [Working directory, git safety, and environment](#8-working-directory-git-safety-and-environment)
9. [Configuration layers and profiles](#9-configuration-layers-and-profiles)
10. [Project instructions: AGENTS.md](#10-project-instructions-agentsmd)
11. [Approvals, sandboxing, and rules](#11-approvals-sandboxing-and-rules)
12. [CLI: interactive and exec](#12-cli-interactive-and-exec)
13. [MCP server and tools](#13-mcp-server-and-tools)
14. [App server (JSON-RPC)](#14-app-server-json-rpc)
15. [Using Codex from the OpenAI Agents SDK](#15-using-codex-from-the-openai-agents-sdk)
16. [References](#16-references)

---

## 1. Overview

### Three ways to embed Codex

1. **Codex SDK (TypeScript)** — Node.js library that **spawns the local `codex` CLI** and exchanges **JSONL events** over stdin/stdout. Use when driving Codex from a server process, internal tool, or desktop app backend.

2. **Codex as an MCP server** — Run `codex mcp-server` and call it from any MCP client (including the OpenAI Agents SDK) using the `codex` and `codex-reply` tools.

3. **Codex app-server** — JSON-RPC protocol for rich clients (e.g. IDE/VS Code extension): auth, approvals, conversation history, full event streaming.

**Auth:** ChatGPT account or OpenAI API key. With API key only, features like cloud threads may be limited. ([Authentication](https://developers.openai.com/codex/auth))

---

## 2. Installation

### CLI (run Codex locally)

```bash
npm install -g @openai/codex
codex
```

**Homebrew (macOS):** `brew install --cask codex`  
**App:** macOS (Apple Silicon) from [Codex app](https://developers.openai.com/codex/app).  
**From source:** Clone [openai/codex](https://github.com/openai/codex), Rust toolchain, `cargo build` in `codex-rs`.

### TypeScript (Codex SDK)

- **Node.js 18+**
- Install:

```bash
npm install @openai/codex-sdk
```

The SDK controls the **local Codex CLI**; workspace path, git repo, auth, and sandbox rules still depend on the runtime environment.

---

## 3. Quickstart

### CLI

```bash
codex "Find and fix the bug in auth.py"
codex exec "Find and fix the bug in auth.py"
```

### TypeScript SDK

```typescript
import { Codex } from "@openai/codex-sdk";

const codex = new Codex();
const thread = codex.startThread();

const turn = await thread.run("Diagnose the test failure and propose a fix");
console.log(turn.finalResponse);
console.log(turn.items);
```

Call `run()` again on the same `Thread` to continue the conversation.

---

## 4. Core API: Codex, Thread, and Turn

### `Codex` (client)

```typescript
const codex = new Codex(/* optional config */);
```

**Constructor options:**

- **`env`** — Environment variables for the spawned Codex CLI (e.g. for sandboxed hosts like Electron). The SDK still injects required vars (`OPENAI_BASE_URL`, `CODEX_API_KEY`) on top.
- **`config`** — JSON of CLI config overrides; the SDK passes them as repeated `--config key=value`.

### `startThread(options?)` → `Thread`

A **Thread** is a persistent conversation.

```typescript
const thread = codex.startThread();
// or with options (see §8):
const thread = codex.startThread({ workingDirectory: "/path/to/project", skipGitRepoCheck: true });
```

### `Thread.run(prompt, options?)` → `Turn`

A **Turn** is one execution step. Input can be a string or structured entries (text + images).

**Turn outputs:**

- **`turn.finalResponse`** — Final assistant response text.
- **`turn.items`** — Structured records (tool activity, file changes, etc.).

---

## 5. Thread/session management

Threads are persisted under **`~/.codex/sessions`**. To resume after losing the in-memory `Thread`:

```typescript
const thread = codex.resumeThread(savedThreadId);
await thread.run("Pick up where you left off");
```

---

## 6. Streaming + events

- **`run()`** — Buffers events until the turn completes.
- **`runStreamed()`** — Returns an async generator of structured events (tool calls, streaming text, file change notifications).

```typescript
const { events } = await thread.runStreamed("Diagnose the test failure and propose a fix");

for await (const event of events) {
  switch (event.type) {
    case "item.completed":
      console.log("item", event.item);
      break;
    case "turn.completed":
      console.log("usage", event.usage);
      break;
  }
}
```

---

## 7. Structured output

Request JSON conforming to a JSON Schema per turn:

```typescript
const schema = {
  type: "object",
  properties: {
    summary: { type: "string" },
    status: { type: "string", enum: ["ok", "action_required"] },
  },
  required: ["summary", "status"],
  additionalProperties: false,
} as const;

const turn = await thread.run("Summarize repository status", { outputSchema: schema });
console.log(turn.finalResponse);
```

You can generate schemas from Zod using `zod-to-json-schema` with `target: "openAi"`.

---

## 8. Working directory, git safety, and environment

### Working directory

Codex runs in the process cwd by default. Set a workspace:

```typescript
const thread = codex.startThread({
  workingDirectory: "/path/to/project",
  skipGitRepoCheck: true,
});
```

Codex normally requires the working directory to be a **Git repository**; `skipGitRepoCheck` bypasses that (use with care).

### Environment (packaged apps / CI)

Override env for the spawned CLI:

```typescript
const codex = new Codex({
  env: { PATH: "/usr/local/bin" },
});
```

The SDK still injects required variables (e.g. `OPENAI_BASE_URL`, `CODEX_API_KEY`).

---

## 9. Configuration layers and profiles

Config is TOML-based:

- **User:** `~/.codex/config.toml` or `$CODEX_HOME/config.toml`
- **Project:** `.codex/config.toml` inside a repo (loaded only when the project is **trusted**)

**Precedence (highest → lowest):** CLI flags / `--config` → profile values → project config (trusted only) → user config → system config → built-in defaults. ([Config basics](https://developers.openai.com/codex/config-basic), [Advanced config](https://developers.openai.com/codex/config-advanced))

**Example config.toml**

```toml
model = "o4-mini"
model_provider = "openai"

[permissions]
approval_policy = "on-request"
sandbox_mode = "workspace-write"

[mcp_servers.filesystem]
command = "npx"
args = ["-y", "@modelcontextprotocol/server-filesystem", "/path/to/allowed"]
enabled = true

[history]
instructions = """
You are a senior software engineer. Write clean, maintainable code.
"""

[projects."/path/to/trusted-project"]
trust_level = "trusted"
```

**CLI overrides**

```bash
codex -c model=gpt-4o "Write a function"
codex -c permissions.approval_policy=never "Run automated task"
codex --profile work "Start work session"
codex --enable unified_exec
codex --disable web_search_request
```

---

## 10. Project instructions: AGENTS.md

Codex supports instruction-discovery files:

- **Repo-level `AGENTS.md`** — Encode project norms (tests to run, docs, style). ([AGENTS.md guide](https://developers.openai.com/codex/guides/agents-md))
- **Per-subdirectory overrides** — Additional instruction files in subdirs.
- **Fallback filenames** — Configure via `project_doc_fallback_filenames` in config (e.g. `TEAM_GUIDE.md`).

---

## 11. Approvals, sandboxing, and rules

### Two-layer model

- **Sandbox mode** — What Codex can do technically (write locations, network).
- **Approval policy** — When it must ask before executing (e.g. leaving sandbox, using network, running commands outside trusted set). ([Security](https://developers.openai.com/codex/security))

### Approval policy

| Value | Description |
|-------|-------------|
| `untrusted` | Prompt for approval (default-like). |
| `on-request` | Prompt when the model requests approval. |
| `never` | No approval prompts; auto-run (use with safe sandbox for automation). |

### Sandbox

| Value | Description |
|-------|-------------|
| `read-only` | No writes. |
| `workspace-write` | Writes in workspace; often no network. |
| `danger-full-access` | No sandbox. |

**CLI:** `codex --sandbox workspace-write`. **MCP:** pass `sandbox` (and `approval-policy`) in the `codex` tool params.

### Rules (experimental)

Rules control which commands can run **outside the sandbox** via `prefix_rule(...)` in `.rules` files (e.g. `~/.codex/rules/default.rules`). Codex scans rule dirs at startup; “Smart approvals” may propose prefixes. ([Rules](https://developers.openai.com/codex/rules))

Test rules:

```bash
codex execpolicy check --pretty --rules ~/.codex/rules/default.rules -- gh pr view 7888 --json title,body,comments
```

---

## 12. CLI: interactive and exec

### Interactive TUI

```bash
codex
codex "Create a Python function to calculate fibonacci numbers"
codex -m gpt-4o "Refactor this code"
codex --search "What's the latest syntax for React hooks?"
codex -i screenshot.png "What's wrong with this UI?"
codex -C /path/to/project "Analyze this codebase"
codex --full-auto "Build a REST API with Express"

codex resume --last
codex resume my-session-name
codex resume <session-id>
codex fork --last
```

### Exec (non-interactive, CI)

- Progress to stderr; final message to stdout.
- **`--json`** — Stdout becomes JSONL event stream: `thread.started`, `turn.started`, `turn.completed`, `turn.failed`, `item.*`, `error`. ([Non-interactive mode](https://developers.openai.com/codex/noninteractive))
- **`--output-schema`** — Save structured JSON output to a file.
- In CI, set **`CODEX_API_KEY`** for the job (supported in `codex exec`).

```bash
codex exec "Generate a unit test for the User class"
echo "Explain this error" | codex exec -
codex exec --json "List all TODO comments in this file"
codex exec --output-schema schema.json "Extract API endpoints from this codebase"
codex exec --last-message-file result.txt "Summarize this README"
codex exec --skip-git-repo-check "Analyze this folder"
codex exec resume --last "Continue where we left off"
```

---

## 13. MCP server and tools

Run Codex as an MCP server so other MCP clients (e.g. OpenAI Agents SDK) can call it.

```bash
codex mcp-server
# or
npx @modelcontextprotocol/inspector codex mcp-server
```

### Tool: `codex`

Starts a new session. Parameters: `prompt` (required), `approval-policy`, `base-instructions`, `cwd`, `include-plan-tool`, `model`, `profile`, `sandbox`, `config`. Response: `structuredContent.threadId`, `structuredContent.content`; plus `content[]` with `type: "text"`, `text`.

### Tool: `codex-reply`

Continues a session: `prompt` (required), `threadId` (required). Same response shape. Use `structuredContent.threadId` from the previous call (or from approval prompts) to chain. ([Use Codex with the Agents SDK](https://developers.openai.com/codex/guides/agents-sdk))

---

## 14. App server (JSON-RPC)

For deep integration (auth, conversation history, streamed events), use **`codex app-server`**: JSON-RPC 2.0 over stdio (JSONL) or experimental WebSocket. ([Codex app-server](https://developers.openai.com/codex/app-server))

**Transports:** `codex app-server` (stdio) or `codex app-server --listen ws://127.0.0.1:4500`. On overload, error `-32001` "Server overloaded; retry later." — retry with backoff.

**Flow:** Connect → `initialize` (params: `clientInfo`) → `initialized` → `thread/start` → response has `thread.id` → `turn/start` (params: `threadId`, `input: [{ type: "text", text }]`) → read streamed notifications.

**Example: Node.js over stdio**

```typescript
const proc = spawn("codex", ["app-server"], { stdio: ["pipe", "pipe", "inherit"] });
const rl = readline.createInterface({ input: proc.stdout });

const send = (message: unknown) => proc.stdin.write(`${JSON.stringify(message)}\n`);
let threadId: string | null = null;

rl.on("line", (line) => {
  const msg = JSON.parse(line);
  if (msg.id === 1 && msg.result?.thread?.id && !threadId) {
    threadId = msg.result.thread.id;
    send({ method: "turn/start", id: 2, params: { threadId, input: [{ type: "text", text: "Summarize this repo." }] } });
  }
});

send({ method: "initialize", id: 0, params: { clientInfo: { name: "my_product", title: "My Product", version: "0.1.0" } } });
send({ method: "initialized", params: {} });
send({ method: "thread/start", id: 1, params: { model: "gpt-5.1-codex" } });
```

**Auth:** `account/read`, `account/login/start`, `account/login/completed`, `account/logout`, `account/updated`; modes `apikey`, `chatgpt`, `chatgptAuthTokens`. Also: `account/rateLimits/read`, `thread/resume`, `command/exec`.

---

## 15. Using Codex from the OpenAI Agents SDK

For multi-agent orchestration (handoffs, traces, multiple specialized agents):

1. Start Codex as a long-running MCP server: `npx codex mcp-server` or `codex mcp-server`.
2. Connect from an agent built with the OpenAI Agents SDK.
3. Call `codex` / `codex-reply` as needed.

**Python example:** Use `MCPServerStdio` with `codex mcp-server`; pass `approval-policy: "never"` and `sandbox: "workspace-write"` in tool params for unattended file creation.

```python
import asyncio
from agents import Agent, Runner
from agents.mcp import MCPServerStdio

async def main():
    async with MCPServerStdio(
        name="Codex CLI",
        params={"command": "npx", "args": ["-y", "codex", "mcp-server"]},
        client_session_timeout_seconds=360000,
    ) as codex_mcp_server:
        developer_agent = Agent(
            name="Game Developer",
            instructions=(
                "You are an expert in building simple games with html + css + javascript. "
                "Save your work in index.html. "
                "Always call codex with \"approval-policy\": \"never\" and \"sandbox\": \"workspace-write\"."
            ),
            mcp_servers=[codex_mcp_server],
        )
        await Runner.run(developer_agent, "Implement a fun new game!")

if __name__ == "__main__":
    asyncio.run(main())
```

Use `structuredContent.threadId` from the last `codex`/`codex-reply` response to continue with `codex-reply`.

---

## 16. References

- [Codex SDK](https://developers.openai.com/codex/sdk) — Overview, install, usage
- [Codex SDK TypeScript README](https://github.com/openai/codex/blob/main/sdk/typescript/README.md) — Threads, streaming, schema output, images, env/config
- [Non-interactive mode (codex exec)](https://developers.openai.com/codex/noninteractive)
- [Security: sandbox + approvals](https://developers.openai.com/codex/security)
- [Config basics](https://developers.openai.com/codex/config-basic) — Precedence
- [Advanced config](https://developers.openai.com/codex/config-advanced) — Project `.codex/config.toml` trust
- [AGENTS.md guide](https://developers.openai.com/codex/guides/agents-md) — Instruction layering, fallback filenames
- [Rules](https://developers.openai.com/codex/rules) — Prefix rules, scanning, testing
- [Use Codex with the Agents SDK](https://developers.openai.com/codex/guides/agents-sdk)
- [Codex app-server](https://developers.openai.com/codex/app-server)
- [Authentication](https://developers.openai.com/codex/auth)
- [Codex overview](https://developers.openai.com/codex) · [Codex app](https://developers.openai.com/codex/app) · [CLI reference](https://developers.openai.com/codex/cli/reference) · [Codex repo](https://github.com/openai/codex)

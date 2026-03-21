# Agentic Framework Comparison & Unified Abstraction Design

> Claude Agent SDK · Codex SDK · OpenCode SDK
> Last updated: March 2026

---

## Table of Contents

1. [Identity & Architecture](#1-identity--architecture)
2. [API Surface Mapping](#2-api-surface-mapping)
3. [What's Same · What's Different · What's Unique](#3-whats-same--whats-different--whats-unique)
4. [Abstraction Layer Schema](#4-abstraction-layer-schema)
5. [Adapter Interface per Framework](#5-adapter-interface-per-framework)
6. [Unified Session with Cross-Framework Subtask Routing](#6-unified-session-with-cross-framework-subtask-routing)
7. [Extensibility for Future Frameworks](#7-extensibility-for-future-frameworks)

---

## 1. Identity & Architecture

### 1.1 High-Level Comparison

| Dimension | Claude Agent SDK | Codex SDK | OpenCode SDK |
|-----------|-----------------|-----------|--------------|
| **Vendor** | Anthropic | OpenAI | Anomaly (open-source) |
| **Package** | `@anthropic-ai/claude-agent-sdk` | `@openai/codex-sdk` | `@opencode-ai/sdk` |
| **Language** | TypeScript + Python | TypeScript only | TypeScript only |
| **Underlying engine** | Claude Code CLI (bundled) | `codex` CLI (spawned via JSONL stdio) | `opencode` HTTP server |
| **Transport** | In-process (agent loop runs inside SDK) | Child process (JSONL over stdin/stdout) | HTTP client → HTTP server (REST + SSE) |
| **LLM provider** | Anthropic (+ Bedrock, Vertex, Foundry) | OpenAI | Any provider via config (Anthropic, OpenAI, etc.) |
| **Default model** | Claude Sonnet/Opus/Haiku | gpt-5.4 / gpt-5.4-mini | Configurable (e.g. `anthropic/claude-3-5-sonnet`) |
| **Session storage** | `~/.claude/projects/{hash}/*.jsonl` | `~/.codex/sessions` | Server-managed (HTTP API) |
| **Config format** | JS options + `.claude/` files + CLAUDE.md | TOML (`.codex/config.toml`) + JS options | JSON (`opencode.json`) + JS options |
| **Auth** | `ANTHROPIC_API_KEY` | `CODEX_API_KEY` / `OPENAI_API_KEY` | Per-provider API keys via `client.auth.set()` |

### 1.2 Architecture Diagrams

```
CLAUDE AGENT SDK
┌─────────────────────────────────────┐
│  Your Code                          │
│  ┌───────────────────────────────┐  │
│  │ query(prompt, options)        │  │
│  │   → async generator           │  │
│  │   → system / assistant / result│ │
│  └──────────┬────────────────────┘  │
│             │ in-process             │
│  ┌──────────▼────────────────────┐  │
│  │ Agent Loop (Claude Code)      │  │
│  │  Tools → MCP → Subagents      │  │
│  └───────────────────────────────┘  │
└─────────────────────────────────────┘

CODEX SDK
┌────────────────────┐   JSONL stdio   ┌───────────────────┐
│  Your Code         │ ◄─────────────► │  codex CLI         │
│  new Codex()       │                 │  (child process)   │
│  thread.run(input) │                 │  Agent loop        │
│  thread.runStreamed │                 │  Tools / Sandbox   │
└────────────────────┘                 └───────────────────┘

OPENCODE SDK
┌────────────────────┐    HTTP/SSE     ┌───────────────────┐
│  Your Code         │ ◄─────────────► │  opencode serve    │
│  createOpencode()  │                 │  (HTTP server)     │
│  client.session.*  │                 │  Agent loop        │
│  client.event.*    │                 │  Tools / MCP       │
└────────────────────┘                 └───────────────────┘
```

### 1.3 Execution Model

| Aspect | Claude | Codex | OpenCode |
|--------|--------|-------|----------|
| **Entry point** | `query()` (function) | `new Codex()` → `thread.run()` (class) | `createOpencode()` → `client.session.prompt()` (HTTP client) |
| **Agent loop** | Runs in-process | Runs in child process | Runs in server process |
| **Multi-turn** | `ClaudeSDKClient` or `continue: true` | Call `thread.run()` repeatedly | Call `session.prompt()` repeatedly |
| **Concurrency** | One query at a time per generator | One turn at a time per thread | Multiple sessions concurrently (server handles it) |
| **Lifecycle** | Generator starts → yields messages → result | `run()` returns Turn / `runStreamed()` yields events | `prompt()` returns result / `event.subscribe()` for SSE |

---

## 2. API Surface Mapping

### 2.1 Session Management

| Operation | Claude Agent SDK | Codex SDK | OpenCode SDK |
|-----------|-----------------|-----------|--------------|
| **Create** | `query({ prompt })` (implicit) | `codex.startThread(opts?)` | `client.session.create({ body: { title } })` |
| **Send message** | `yield { type: "user", message }` via generator | `thread.run(input)` | `client.session.prompt({ path: { id }, body: { parts } })` |
| **Resume** | `options.resume = sessionId` | `codex.resumeThread(threadId)` | `client.session.prompt({ path: { id } })` (same session) |
| **Fork** | `options.resume + forkSession: true` | `thread/fork` (App Server only) | `client.session.children()` (implicit) |
| **List** | `listSessions(cwd)` | N/A (filesystem-based) | `client.session.list()` |
| **Get messages** | `getSessionMessages(sessionId)` | Via turn `items` array | `client.session.messages({ path: { id } })` |
| **Abort** | Generator `return()` / destroy | `turn/interrupt` (App Server) | `client.session.abort({ path: { id } })` |
| **Delete** | N/A | N/A | `client.session.delete({ path: { id } })` |
| **Session ID source** | `ResultMessage.session_id` | Thread ID from `startThread()` | `session.id` from `create()` |

### 2.2 Tool System

| Aspect | Claude Agent SDK | Codex SDK | OpenCode SDK |
|--------|-----------------|-----------|--------------|
| **Built-in tools** | Read, Write, Edit, Bash, Glob, Grep, WebSearch, WebFetch, AskUserQuestion, Agent, Skill | Read, Edit, Write, Bash, WebSearch, MCP tools | bash, edit, write, read, grep, glob, list, patch, skill, todowrite, todoread, webfetch, websearch, question, lsp |
| **Tool naming** | PascalCase (`Read`, `Write`, `Bash`) | Internal (not exposed by name) | lowercase (`bash`, `edit`, `read`) |
| **Custom tool definition** | `tool(name, desc, zodSchema, handler)` → MCP server | Not supported (MCP only) | `tool()` from `@opencode-ai/plugin` in `.opencode/tools/` |
| **Custom tool registration** | `createSdkMcpServer()` → `mcpServers` | Config MCP in `config.toml` | Plugin files or MCP config |
| **MCP support** | Yes (stdio, http, sse, in-process SDK) | Yes (stdio via config.toml) | Yes (via config) |
| **MCP tool naming** | `mcp__{server}__{tool}` | Internal | `{mcpserver}_{tool}` (wildcard: `mymcp_*`) |
| **Tool allowlist** | `allowedTools: ["Read", "mcp__gh__*"]` | `enabled_tools` in config | N/A (tools config: `{ write: false }`) |
| **Tool denylist** | `disallowedTools: ["Bash"]` | `disabled_tools` in config | `tools: { bash: false }` |

### 2.3 Permission / Approval Model

| Aspect | Claude Agent SDK | Codex SDK | OpenCode SDK |
|--------|-----------------|-----------|--------------|
| **Permission modes** | `default`, `dontAsk`, `acceptEdits`, `bypassPermissions`, `plan` | `on-request`, `never`, `untrusted` | Per-tool: `allow`, `deny`, `ask` |
| **Granularity** | Mode applies globally; per-tool via hooks/callbacks | Global policy + sandbox mode | Per-tool in config |
| **Approval callback** | `canUseTool(toolName, input) → { behavior, updatedInput? }` | App Server notifications → RPC approval | `postSessionByIdPermissionsByPermissionId()` |
| **Input modification** | Yes (`updatedInput` in canUseTool or hooks) | No | No |
| **Remember decision** | No (per-invocation) | No | Yes (`remember: true` in approval) |
| **Hooks for approval** | `PreToolUse` → `permissionDecision: "allow"/"deny"/"ask"` | N/A | N/A |

### 2.4 Streaming

| Aspect | Claude Agent SDK | Codex SDK | OpenCode SDK |
|--------|-----------------|-----------|--------------|
| **Streaming API** | `async for msg of query()` | `thread.runStreamed()` → `events` | `client.event.subscribe()` → SSE stream |
| **Buffered API** | N/A (always streaming) | `thread.run()` → returns Turn | `session.prompt()` → returns result |
| **Message types** | `system` (init, compact), `assistant` (text, tool_use), `result` (success, error) | `item.completed`, `turn.completed` | SSE events: `message.delta`, etc. |
| **Structured output** | N/A (not built-in) | `outputSchema` in `run()` options | `format: { type: "json_schema", schema }` in prompt body |

### 2.5 Subagents / Multi-Agent

| Aspect | Claude Agent SDK | Codex SDK | OpenCode SDK |
|--------|-----------------|-----------|--------------|
| **Definition** | `agents: { id: { description, prompt, tools?, model? } }` | N/A (manual via prompts/UI) | `client.app.agents()` (list configured agents) |
| **Invocation** | Automatic (model picks by description) or explicit | Manual (slash commands, UI) | Via agent config |
| **Model selection** | `sonnet`, `opus`, `haiku`, `inherit` | Same as parent or config override | Per-prompt: `model: { providerID, modelID }` |
| **Isolation** | Subagent gets own prompt; no parent history | Separate thread | Separate session |
| **Tool inheritance** | Inherits all or subset via `tools` field | Same as parent | Same as parent |
| **Detection** | `tool_use.name === "Agent"` + `parent_tool_use_id` | Items in turn output | Messages in session |

### 2.6 Configuration

| Aspect | Claude Agent SDK | Codex SDK | OpenCode SDK |
|--------|-----------------|-----------|--------------|
| **Inline config** | `options` object in `query()` | `config` object in `new Codex()` | `config` object in `createOpencode()` |
| **Project config** | `.claude/` dir + `CLAUDE.md` | `.codex/config.toml` | `opencode.json` |
| **User config** | `~/.claude/` | `~/.codex/config.toml` | `~/.config/opencode/opencode.json` |
| **Config format** | JS/JSON + Markdown | TOML | JSON |
| **Precedence** | Code → Project → User → Env | Code → Project → User → Env | Code → Project → Global |
| **Custom instructions** | `CLAUDE.md` files | System prompt in config | `AGENTS.md` / `session.init()` |

---

## 3. What's Same · What's Different · What's Unique

### 3.1 What's the SAME (Abstractable)

These concepts exist in all three frameworks with similar semantics:

| Concept | Notes |
|---------|-------|
| **Session/Thread** | A conversation container that holds messages and can be resumed |
| **Message/Turn** | A user input + agent response cycle |
| **Prompt → Response** | Send text, get text + tool actions back |
| **Built-in file tools** | Read, Write/Create, Edit files — all three have them |
| **Built-in shell tool** | Bash/shell command execution |
| **Built-in search tools** | Grep/text search + Glob/file search |
| **MCP server support** | All three can connect to MCP servers |
| **Structured output** | All three support JSON schema-constrained responses |
| **Streaming** | All three offer real-time message streaming |
| **Working directory** | All three scope to a `cwd` |
| **Permission/approval** | All three have a way to approve or deny tool calls |
| **Tool allow/deny** | All three can whitelist or blacklist tools |
| **Multi-turn** | All three support multi-turn conversations |
| **Resume** | All three can resume a previous conversation |
| **Config layering** | All three merge code config → project config → user config |

### 3.2 What's DIFFERENT (Needs Normalization)

| Dimension | Claude | Codex | OpenCode | Abstraction Strategy |
|-----------|--------|-------|----------|---------------------|
| **Session creation** | Implicit (via `query()`) | Explicit (`startThread()`) | Explicit (`session.create()`) | Always explicit; adapter creates implicitly for Claude |
| **Message format** | Generator yields `{ type: "user", message }` | String or `[{ type: "text" }, { type: "local_image" }]` | `{ parts: [{ type: "text", text }] }` | Normalize to `Part[]` array |
| **Response format** | Stream of `system`/`assistant`/`result` messages | `Turn { finalResponse, items }` or events | `{ info: Message, parts: Part[] }` | Normalize to `UnifiedResponse` |
| **Tool naming** | PascalCase + `mcp__server__tool` | Internal (not exposed) | lowercase + `mcpserver_tool` | Map to canonical names |
| **Permission model** | Global mode + per-tool hooks + callback | Global sandbox policy + approval policy | Per-tool config (`allow`/`deny`/`ask`) | Normalize to per-tool `allow`/`deny`/`ask` |
| **Streaming events** | Message objects in async generator | `item.completed`, `turn.completed` | SSE `message.delta` events | Normalize to `onText`, `onToolCall`, `onComplete` |
| **Structured output** | Not built-in (use custom tool) | `outputSchema` in run options | `format` in prompt body | Unified `outputSchema` option |
| **Subagent definition** | Declarative (`agents` config) | Manual (no API) | Server-managed agents | Unified `AgentDef` with adapter mapping |
| **Config format** | JS options + Markdown | TOML + JS options | JSON + JS options | Normalize to JS options; adapters translate |
| **Auth** | `ANTHROPIC_API_KEY` env | `CODEX_API_KEY` / `OPENAI_API_KEY` env | Per-provider via `auth.set()` | Unified `credentials` config per provider |

### 3.3 What's UNIQUE (Framework-Specific Extensions)

#### Claude Agent SDK Only
- **Hooks system** — `PreToolUse`, `PostToolUse`, `SubagentStart`, etc. with matchers
- **Input modification** — `updatedInput` in canUseTool/hooks (rewrite tool inputs before execution)
- **System prompt presets** — `{ type: "preset", preset: "claude_code", append: "..." }`
- **CLAUDE.md** — Markdown-based project instructions
- **Skills** — `SKILL.md` files with YAML frontmatter
- **Plugins** — `.claude-plugin/` bundles with tools, commands, hooks, agents
- **Slash commands** — `/compact`, `/clear`, custom commands
- **Python SDK** — Full Python client with `ClaudeSDKClient`
- **Cost tracking** — `total_cost_usd`, `modelUsage` per-model breakdown
- **Session forking** — `forkSession: true`
- **Compaction** — `compact_boundary` events for context management
- **Setting sources** — `["user", "project", "local"]` for config loading

#### Codex SDK Only
- **Sandbox modes** — `workspace-write`, `read-only`, `danger-full-access`
- **App Server** — Full JSON-RPC 2.0 server protocol (stdio/WebSocket)
- **Thread forking** — `thread/fork` via App Server
- **Turn steering** — `turn/steer` to inject input mid-turn
- **Turn interruption** — `turn/interrupt` to cancel mid-turn
- **Non-interactive mode** — `codex exec` for CI/CD
- **Git requirement** — Requires Git repo by default (can skip)
- **Image input** — `{ type: "local_image", path }` natively
- **Extended reasoning** — Model-level reasoning traces
- **MCP as server** — `codex mcp-server` exposes Codex itself as MCP tool

#### OpenCode SDK Only
- **HTTP server architecture** — Standalone `opencode serve` with OpenAPI spec
- **mDNS discovery** — Network service discovery
- **LSP integration** — Built-in `lsp` tool
- **Session sharing** — `session.share()` / `session.unshare()`
- **Session revert** — `session.revert()` / `session.unrevert()`
- **Permission remembering** — `remember: true` in approval
- **Todo tools** — Built-in `todowrite` / `todoread`
- **File status** — `file.status()` for tracked files
- **Symbol search** — `find.symbols()` for workspace symbols
- **Multi-provider** — Switch providers per-prompt (`model: { providerID, modelID }`)
- **TUI control** — `client.tui.*` for controlling the terminal UI
- **CORS config** — Built-in CORS support for web clients
- **Server auth** — HTTP basic auth via env vars

---

## 4. Abstraction Layer Schema

### 4.1 Core Types

```typescript
type FrameworkId = "claude" | "codex" | "opencode" | string;

type UnifiedConfig = {
  frameworks: Record<FrameworkId, FrameworkConfig>;
  defaultFramework: FrameworkId;
  session?: {
    persistenceDir?: string;
  };
};

type FrameworkConfig = {
  id: FrameworkId;
  credentials: Record<string, string>;
  model?: string;
  cwd?: string;
  tools?: ToolConfig;
  permissions?: PermissionConfig;
  mcp?: Record<string, McpServerConfig>;
  sandbox?: SandboxConfig;
  raw?: Record<string, unknown>; // framework-specific passthrough
};
```

### 4.2 Session & Messaging

```typescript
type UnifiedSession = {
  id: string;
  framework: FrameworkId;
  createdAt: number;
  metadata: Record<string, unknown>;
};

type Part =
  | { type: "text"; text: string }
  | { type: "image"; source: ImageSource }
  | { type: "file"; path: string };

type ImageSource =
  | { type: "base64"; mediaType: string; data: string }
  | { type: "path"; path: string }
  | { type: "url"; url: string };

type PromptInput = {
  parts: Part[];
  model?: ModelRef;
  outputSchema?: JsonSchema;
  noReply?: boolean;
};

type ModelRef = {
  framework?: FrameworkId;
  model: string;
};
```

### 4.3 Response

```typescript
type UnifiedResponse = {
  id: string;
  sessionId: string;
  framework: FrameworkId;
  content: ResponseContent[];
  usage?: UsageInfo;
  cost?: CostInfo;
  raw?: unknown; // original framework response
};

type ResponseContent =
  | { type: "text"; text: string }
  | { type: "tool_call"; tool: string; input: Record<string, unknown>; output?: string }
  | { type: "error"; code: string; message: string };

type UsageInfo = {
  inputTokens?: number;
  outputTokens?: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
};

type CostInfo = {
  totalUsd?: number;
  perModel?: Record<string, { inputTokens: number; outputTokens: number; costUsd: number }>;
};
```

### 4.4 Streaming

```typescript
type StreamEvent =
  | { type: "session.created"; session: UnifiedSession }
  | { type: "text.delta"; text: string }
  | { type: "tool_call.start"; tool: string; input: Record<string, unknown> }
  | { type: "tool_call.complete"; tool: string; output: string }
  | { type: "approval.required"; requestId: string; tool: string; input: Record<string, unknown> }
  | { type: "response.complete"; response: UnifiedResponse }
  | { type: "error"; code: string; message: string };
```

### 4.5 Tools

```typescript
type CanonicalToolName =
  | "file.read"
  | "file.write"
  | "file.edit"
  | "file.glob"
  | "file.list"
  | "file.patch"
  | "shell.bash"
  | "search.grep"
  | "search.web"
  | "fetch.web"
  | "user.question"
  | "agent.invoke"
  | "skill.invoke"
  | "todo.write"
  | "todo.read"
  | "lsp.query"
  | string; // MCP tools: "mcp:{server}:{tool}"

type ToolConfig = {
  allowed?: CanonicalToolName[];
  denied?: CanonicalToolName[];
};

type PermissionConfig = {
  defaults: "allow" | "deny" | "ask";
  overrides?: Record<CanonicalToolName, "allow" | "deny" | "ask">;
};
```

### 4.6 Tool Name Mapping

```typescript
const TOOL_MAP: Record<CanonicalToolName, Record<FrameworkId, string>> = {
  "file.read":     { claude: "Read",       codex: "read",       opencode: "read" },
  "file.write":    { claude: "Write",      codex: "write",      opencode: "write" },
  "file.edit":     { claude: "Edit",       codex: "edit",       opencode: "edit" },
  "file.glob":     { claude: "Glob",       codex: "glob",       opencode: "glob" },
  "file.list":     { claude: "Glob",       codex: "list",       opencode: "list" },
  "file.patch":    { claude: "Edit",       codex: "patch",      opencode: "patch" },
  "shell.bash":    { claude: "Bash",       codex: "bash",       opencode: "bash" },
  "search.grep":   { claude: "Grep",       codex: "grep",       opencode: "grep" },
  "search.web":    { claude: "WebSearch",  codex: "web_search", opencode: "websearch" },
  "fetch.web":     { claude: "WebFetch",   codex: "web_fetch",  opencode: "webfetch" },
  "user.question": { claude: "AskUserQuestion", codex: "question", opencode: "question" },
  "agent.invoke":  { claude: "Agent",      codex: "agent",      opencode: "agent" },
  "skill.invoke":  { claude: "Skill",      codex: "skill",      opencode: "skill" },
  "todo.write":    { claude: "TodoWrite",  codex: "todowrite",  opencode: "todowrite" },
  "todo.read":     { claude: "TodoRead",   codex: "todoread",   opencode: "todoread" },
};
```

### 4.7 MCP Config

```typescript
type McpServerConfig = {
  transport: "stdio" | "http" | "sse";
  command?: string;
  args?: string[];
  url?: string;
  env?: Record<string, string>;
  headers?: Record<string, string>;
};
```

### 4.8 Subagent

```typescript
type SubagentDef = {
  id: string;
  description: string;
  prompt: string;
  framework?: FrameworkId; // which framework runs this subagent
  model?: string;
  tools?: CanonicalToolName[];
};
```

### 4.9 Sandbox

```typescript
type SandboxConfig =
  | { mode: "full-access" }
  | { mode: "workspace-write"; networkAccess?: boolean }
  | { mode: "read-only" };
```

---

## 5. Adapter Interface per Framework

### 5.1 Core Adapter Interface

```typescript
type FrameworkAdapter = {
  readonly id: FrameworkId;

  initialize(config: FrameworkConfig): Promise<void>;
  dispose(): Promise<void>;

  // Session
  createSession(opts?: { cwd?: string; title?: string }): Promise<UnifiedSession>;
  resumeSession(sessionId: string): Promise<UnifiedSession>;
  listSessions(): Promise<UnifiedSession[]>;
  deleteSession(sessionId: string): Promise<void>;

  // Messaging
  prompt(sessionId: string, input: PromptInput): Promise<UnifiedResponse>;
  promptStreamed(sessionId: string, input: PromptInput): AsyncIterable<StreamEvent>;
  abort(sessionId: string): Promise<void>;

  // Approval
  approveToolCall(sessionId: string, requestId: string, decision: ApprovalDecision): Promise<void>;

  // Info
  getMessages(sessionId: string): Promise<UnifiedResponse[]>;
  getSupportedTools(): CanonicalToolName[];
  getCapabilities(): AdapterCapabilities;
};

type ApprovalDecision =
  | { action: "allow"; updatedInput?: Record<string, unknown> }
  | { action: "deny"; reason?: string };

type AdapterCapabilities = {
  streaming: boolean;
  structuredOutput: boolean;
  imageInput: boolean;
  subagents: boolean;
  sessionFork: boolean;
  hooks: boolean;
  inputModification: boolean;
  costTracking: boolean;
  sandboxModes: boolean;
  turnSteering: boolean;
  turnInterrupt: boolean;
  sessionSharing: boolean;
  permissionRemember: boolean;
  multiProvider: boolean;
  lsp: boolean;
};
```

### 5.2 Claude Adapter Implementation Sketch

```typescript
const createClaudeAdapter = (): FrameworkAdapter => {
  let sessions: Map<string, AsyncGenerator> = new Map();

  return {
    id: "claude",

    async initialize(config) {
      process.env.ANTHROPIC_API_KEY = config.credentials.apiKey;
    },

    async dispose() {
      for (const [, gen] of sessions) gen.return(undefined);
      sessions.clear();
    },

    async createSession(opts) {
      // Claude creates sessions implicitly on first query
      // We generate a placeholder ID; real ID comes from ResultMessage
      return { id: crypto.randomUUID(), framework: "claude", createdAt: Date.now(), metadata: { cwd: opts?.cwd } };
    },

    async resumeSession(sessionId) {
      return { id: sessionId, framework: "claude", createdAt: Date.now(), metadata: {} };
    },

    async prompt(sessionId, input) {
      const options = buildClaudeOptions(sessionId, input);
      const messages: unknown[] = [];

      for await (const msg of query({ prompt: partsToClaudePrompt(input.parts), options })) {
        messages.push(msg);
      }

      return normalizeClaudeResponse(sessionId, messages);
    },

    async *promptStreamed(sessionId, input) {
      const options = buildClaudeOptions(sessionId, input);

      for await (const msg of query({ prompt: partsToClaudePrompt(input.parts), options })) {
        yield* normalizeClaudeStreamEvent(msg);
      }
    },

    async approveToolCall(sessionId, requestId, decision) {
      // Handled via canUseTool callback set during initialize
    },

    // ... remaining methods
    async abort(sessionId) { sessions.get(sessionId)?.return(undefined); },
    async listSessions() { return []; /* listSessions(cwd) */ },
    async deleteSession() { /* N/A for Claude */ },
    async getMessages(sessionId) { return []; /* getSessionMessages(sessionId) */ },
    getSupportedTools() { return ["file.read", "file.write", "file.edit", "shell.bash", "file.glob", "search.grep", "search.web", "fetch.web", "user.question", "agent.invoke", "skill.invoke"]; },
    getCapabilities() {
      return {
        streaming: true, structuredOutput: false, imageInput: true,
        subagents: true, sessionFork: true, hooks: true,
        inputModification: true, costTracking: true, sandboxModes: false,
        turnSteering: false, turnInterrupt: false, sessionSharing: false,
        permissionRemember: false, multiProvider: false, lsp: false,
      };
    },
  };
};
```

### 5.3 Codex Adapter Implementation Sketch

```typescript
const createCodexAdapter = (): FrameworkAdapter => {
  let codex: Codex;
  let threads: Map<string, Thread> = new Map();

  return {
    id: "codex",

    async initialize(config) {
      codex = new Codex({
        env: { CODEX_API_KEY: config.credentials.apiKey },
        config: translateToCodexConfig(config),
        baseUrl: config.raw?.baseUrl as string | undefined,
      });
    },

    async dispose() { threads.clear(); },

    async createSession(opts) {
      const thread = codex.startThread({
        workingDirectory: opts?.cwd,
        skipGitRepoCheck: true,
      });
      const id = crypto.randomUUID(); // thread ID captured from first run
      threads.set(id, thread);
      return { id, framework: "codex", createdAt: Date.now(), metadata: {} };
    },

    async resumeSession(sessionId) {
      const thread = codex.resumeThread(sessionId);
      threads.set(sessionId, thread);
      return { id: sessionId, framework: "codex", createdAt: Date.now(), metadata: {} };
    },

    async prompt(sessionId, input) {
      const thread = threads.get(sessionId)!;
      const turn = await thread.run(
        partsToCodexInput(input.parts),
        input.outputSchema ? { outputSchema: input.outputSchema } : undefined,
      );
      return normalizeCodexResponse(sessionId, turn);
    },

    async *promptStreamed(sessionId, input) {
      const thread = threads.get(sessionId)!;
      const { events } = await thread.runStreamed(partsToCodexInput(input.parts));
      for await (const event of events) {
        yield* normalizeCodexStreamEvent(event);
      }
    },

    async approveToolCall(sessionId, requestId, decision) {
      // Codex approval is via App Server protocol; adapter bridges it
    },

    async abort(sessionId) { /* turn/interrupt via App Server */ },
    async listSessions() { return []; },
    async deleteSession() { /* N/A */ },
    async getMessages(sessionId) { return []; },
    getSupportedTools() { return ["file.read", "file.write", "file.edit", "shell.bash", "search.grep", "search.web"]; },
    getCapabilities() {
      return {
        streaming: true, structuredOutput: true, imageInput: true,
        subagents: false, sessionFork: true, hooks: false,
        inputModification: false, costTracking: false, sandboxModes: true,
        turnSteering: true, turnInterrupt: true, sessionSharing: false,
        permissionRemember: false, multiProvider: false, lsp: false,
      };
    },
  };
};
```

### 5.4 OpenCode Adapter Implementation Sketch

```typescript
const createOpenCodeAdapter = (): FrameworkAdapter => {
  let client: OpencodeClient;
  let server: { url: string; close: () => void } | undefined;

  return {
    id: "opencode",

    async initialize(config) {
      const result = await createOpencode({
        port: config.raw?.port as number | undefined,
        config: translateToOpenCodeConfig(config),
      });
      client = result.client;
      server = result.server;
    },

    async dispose() { server?.close(); },

    async createSession(opts) {
      const session = await client.session.create({ body: { title: opts?.title } });
      return { id: session.id, framework: "opencode", createdAt: Date.now(), metadata: {} };
    },

    async resumeSession(sessionId) {
      const session = await client.session.get({ path: { id: sessionId } });
      return { id: session.id, framework: "opencode", createdAt: Date.now(), metadata: {} };
    },

    async prompt(sessionId, input) {
      const result = await client.session.prompt({
        path: { id: sessionId },
        body: {
          parts: partsToOpenCodeParts(input.parts),
          model: input.model ? { providerID: input.model.framework!, modelID: input.model.model } : undefined,
          format: input.outputSchema ? { type: "json_schema", schema: input.outputSchema } : undefined,
        },
      });
      return normalizeOpenCodeResponse(sessionId, result);
    },

    async *promptStreamed(sessionId, input) {
      // Send prompt (non-blocking)
      client.session.prompt({
        path: { id: sessionId },
        body: { parts: partsToOpenCodeParts(input.parts) },
      });
      // Stream events via SSE
      const events = await client.event.subscribe();
      for await (const event of events.stream) {
        yield* normalizeOpenCodeStreamEvent(event);
      }
    },

    async approveToolCall(sessionId, requestId, decision) {
      await client.session.postSessionByIdPermissionsByPermissionId({
        path: { id: sessionId, permissionId: requestId },
        body: { response: decision.action === "allow" ? "allow" : "deny", remember: false },
      });
    },

    async abort(sessionId) { await client.session.abort({ path: { id: sessionId } }); },
    async listSessions() { return (await client.session.list()).map(normalizeOpenCodeSession); },
    async deleteSession(id) { await client.session.delete({ path: { id } }); },
    async getMessages(sessionId) { return []; /* client.session.messages() */ },
    getSupportedTools() { return ["file.read", "file.write", "file.edit", "file.glob", "file.list", "file.patch", "shell.bash", "search.grep", "search.web", "fetch.web", "user.question", "skill.invoke", "todo.write", "todo.read", "lsp.query"]; },
    getCapabilities() {
      return {
        streaming: true, structuredOutput: true, imageInput: false,
        subagents: true, sessionFork: false, hooks: false,
        inputModification: false, costTracking: false, sandboxModes: false,
        turnSteering: false, turnInterrupt: false, sessionSharing: true,
        permissionRemember: true, multiProvider: true, lsp: true,
      };
    },
  };
};
```

---

## 6. Unified Session with Cross-Framework Subtask Routing

### 6.1 The Problem

You want a single "meta-session" where:
- Subtask A runs on Claude (good at code review, has hooks)
- Subtask B runs on Codex (good at execution, has sandbox)
- Subtask C runs on OpenCode (multi-provider, cost-efficient)

All within one logical conversation with shared context.

### 6.2 Architecture

```
┌──────────────────────────────────────────────────────┐
│  UnifiedOrchestrator                                 │
│  ┌────────────────────────────────────────────────┐  │
│  │  MetaSession                                   │  │
│  │  id: "meta-abc123"                              │  │
│  │  context: SharedContext (messages, files, state)│  │
│  │                                                 │  │
│  │  ┌─────────┐  ┌─────────┐  ┌──────────────┐   │  │
│  │  │ Task 1  │  │ Task 2  │  │ Task 3       │   │  │
│  │  │ Claude  │  │ Codex   │  │ OpenCode     │   │  │
│  │  │ Review  │→ │ Execute │→ │ Verify       │   │  │
│  │  │ code    │  │ fix     │  │ multi-model  │   │  │
│  │  └─────────┘  └─────────┘  └──────────────┘   │  │
│  └────────────────────────────────────────────────┘  │
│                                                      │
│  Adapters:  ClaudeAdapter  CodexAdapter  OpenCodeAdapter │
└──────────────────────────────────────────────────────┘
```

### 6.3 MetaSession Type

```typescript
type MetaSession = {
  id: string;
  context: SharedContext;
  tasks: TaskRecord[];
  activeTaskId?: string;
};

type SharedContext = {
  messages: ContextMessage[];
  files: Map<string, string>; // path → content snapshot
  workingDirectory: string;
  metadata: Record<string, unknown>;
};

type ContextMessage = {
  role: "user" | "assistant" | "system";
  content: string;
  framework?: FrameworkId;
  taskId?: string;
  timestamp: number;
};

type TaskRecord = {
  id: string;
  framework: FrameworkId;
  frameworkSessionId: string;
  description: string;
  status: "pending" | "running" | "completed" | "failed" | "aborted";
  input: PromptInput;
  output?: UnifiedResponse;
  startedAt?: number;
  completedAt?: number;
};
```

### 6.4 Orchestrator

```typescript
type UnifiedOrchestrator = {
  readonly config: UnifiedConfig;
  readonly adapters: Map<FrameworkId, FrameworkAdapter>;

  // Adapter management
  registerAdapter(adapter: FrameworkAdapter): void;
  getAdapter(framework: FrameworkId): FrameworkAdapter;

  // Meta-session management
  createMetaSession(opts: { cwd: string }): Promise<MetaSession>;
  resumeMetaSession(id: string): Promise<MetaSession>;

  // Task routing
  runTask(metaSessionId: string, task: TaskRequest): Promise<UnifiedResponse>;
  runTaskStreamed(metaSessionId: string, task: TaskRequest): AsyncIterable<StreamEvent>;

  // Simple prompt (uses default framework)
  prompt(metaSessionId: string, input: PromptInput): Promise<UnifiedResponse>;

  // Approval (routed to correct adapter)
  approveToolCall(metaSessionId: string, requestId: string, decision: ApprovalDecision): Promise<void>;

  // Lifecycle
  dispose(): Promise<void>;
};

type TaskRequest = {
  framework: FrameworkId;
  description: string;
  input: PromptInput;
  injectContext?: boolean; // prepend shared context as system message
  model?: string;
};
```

### 6.5 Context Bridging Strategy

When switching frameworks mid-session, the orchestrator needs to bridge context:

```typescript
const buildContextInjection = (context: SharedContext, maxTokens: number): Part[] => {
  const summary = summarizeMessages(context.messages, maxTokens);
  const fileList = [...context.files.keys()].join("\n");

  return [{
    type: "text",
    text: [
      "## Prior Context",
      "",
      "This task is part of a larger session. Here is the relevant context:",
      "",
      summary,
      "",
      "## Relevant Files",
      "",
      fileList,
    ].join("\n"),
  }];
};
```

**Flow:**

1. User creates MetaSession
2. User submits TaskRequest with `framework: "claude"`, `injectContext: true`
3. Orchestrator:
   a. Gets/creates a framework-specific session via `ClaudeAdapter.createSession()`
   b. Prepends shared context to the prompt
   c. Calls `adapter.prompt()` or `adapter.promptStreamed()`
   d. Captures response → updates `SharedContext.messages`
4. User submits next TaskRequest with `framework: "codex"`
5. Orchestrator:
   a. Creates Codex session via `CodexAdapter.createSession()`
   b. Injects accumulated context from step 3
   c. Runs task on Codex
   d. Captures response → updates SharedContext

### 6.6 Automatic Framework Selection (Optional)

```typescript
type RoutingStrategy = (task: TaskRequest, capabilities: Map<FrameworkId, AdapterCapabilities>) => FrameworkId;

const defaultRouter: RoutingStrategy = (task, caps) => {
  if (task.input.outputSchema) {
    // Prefer frameworks with structured output
    for (const [id, cap] of caps) {
      if (cap.structuredOutput) return id;
    }
  }
  if (task.description.includes("sandbox") || task.description.includes("execute")) {
    for (const [id, cap] of caps) {
      if (cap.sandboxModes) return id;
    }
  }
  return "claude"; // default fallback
};
```

---

## 7. Extensibility for Future Frameworks

### 7.1 Adding a New Framework

To add a new framework (e.g. Cursor Agent SDK, Aider, Devin, etc.):

**Step 1:** Implement `FrameworkAdapter`

```typescript
// adapters/cursor.ts
export const createCursorAdapter = (): FrameworkAdapter => ({
  id: "cursor",
  async initialize(config) { /* ... */ },
  async createSession(opts) { /* ... */ },
  async prompt(sessionId, input) { /* ... */ },
  // ... all methods
});
```

**Step 2:** Add tool name mappings

```typescript
// Extend TOOL_MAP
TOOL_MAP["file.read"].cursor = "ReadFile";
TOOL_MAP["file.write"].cursor = "WriteFile";
// ...
```

**Step 3:** Register with orchestrator

```typescript
orchestrator.registerAdapter(createCursorAdapter());
```

That's it. No changes to core types, orchestrator, or existing adapters.

### 7.2 Adapter Contract Guarantees

Every adapter MUST:

| Requirement | Reason |
|-------------|--------|
| Implement all methods in `FrameworkAdapter` | Core interface contract |
| Return `UnifiedSession` from session methods | Session portability |
| Return `UnifiedResponse` from prompt methods | Response normalization |
| Yield `StreamEvent` from streaming methods | Streaming normalization |
| Report capabilities honestly via `getCapabilities()` | Feature detection |
| Map tool names to canonical names | Tool name normalization |
| Handle `dispose()` gracefully | Resource cleanup |
| Throw typed errors for unsupported operations | Clear failure modes |

Every adapter MAY:

| Optional | Notes |
|----------|-------|
| Support framework-specific features via `raw` fields | Escape hatch |
| Cache sessions in memory | Performance |
| Implement `getCapabilities()` dynamically | Runtime feature detection |

### 7.3 Plugin Registration Pattern

```typescript
type AdapterPlugin = {
  id: FrameworkId;
  displayName: string;
  version: string;
  createAdapter: (config: FrameworkConfig) => FrameworkAdapter;
  toolMappings: Partial<Record<CanonicalToolName, string>>;
  defaultConfig?: Partial<FrameworkConfig>;
};

// Registration
const registry = new AdapterRegistry();

registry.register({
  id: "claude",
  displayName: "Claude Agent SDK",
  version: "1.0.0",
  createAdapter: createClaudeAdapter,
  toolMappings: { "file.read": "Read", "file.write": "Write" /* ... */ },
  defaultConfig: { model: "sonnet" },
});

registry.register({
  id: "codex",
  displayName: "Codex SDK",
  version: "1.0.0",
  createAdapter: createCodexAdapter,
  toolMappings: { "file.read": "read", "file.write": "write" /* ... */ },
  defaultConfig: { model: "gpt-5.4" },
});

// Future: anyone can publish adapter plugins
registry.register({
  id: "cursor",
  displayName: "Cursor Agent SDK",
  version: "0.1.0",
  createAdapter: createCursorAdapter,
  toolMappings: { "file.read": "ReadFile" /* ... */ },
});
```

### 7.4 Full Dependency Graph

```
@agentic/core           → Types, interfaces, orchestrator, registry
@agentic/adapter-claude  → Claude Agent SDK adapter
@agentic/adapter-codex   → Codex SDK adapter
@agentic/adapter-opencode → OpenCode SDK adapter
@agentic/adapter-*       → Future adapters (separate packages)
```

### 7.5 Configuration Example (End-User)

```typescript
import { createOrchestrator } from "@agentic/core";
import { createClaudeAdapter } from "@agentic/adapter-claude";
import { createCodexAdapter } from "@agentic/adapter-codex";
import { createOpenCodeAdapter } from "@agentic/adapter-opencode";

const orchestrator = createOrchestrator({
  frameworks: {
    claude: {
      id: "claude",
      credentials: { apiKey: process.env.ANTHROPIC_API_KEY! },
      model: "sonnet",
      cwd: process.cwd(),
    },
    codex: {
      id: "codex",
      credentials: { apiKey: process.env.CODEX_API_KEY! },
      model: "gpt-5.4-mini",
      sandbox: { mode: "workspace-write", networkAccess: true },
    },
    opencode: {
      id: "opencode",
      credentials: { apiKey: process.env.ANTHROPIC_API_KEY! },
      model: "anthropic/claude-3-5-sonnet",
    },
  },
  defaultFramework: "claude",
  adapters: [createClaudeAdapter(), createCodexAdapter(), createOpenCodeAdapter()],
});

// Create meta-session
const session = await orchestrator.createMetaSession({ cwd: process.cwd() });

// Task 1: Claude reviews code
const review = await orchestrator.runTask(session.id, {
  framework: "claude",
  description: "Review the authentication module for security issues",
  input: { parts: [{ type: "text", text: "Review src/auth/ for security vulnerabilities" }] },
  injectContext: false,
});

// Task 2: Codex fixes issues (with context from Claude's review)
const fix = await orchestrator.runTask(session.id, {
  framework: "codex",
  description: "Fix the security issues found in review",
  input: { parts: [{ type: "text", text: "Fix the security issues identified above" }] },
  injectContext: true, // injects Claude's review as context
});

// Task 3: OpenCode verifies with a different model
const verify = await orchestrator.runTaskStreamed(session.id, {
  framework: "opencode",
  description: "Verify fixes are correct",
  input: {
    parts: [{ type: "text", text: "Verify the security fixes are correct and complete" }],
    model: { framework: "opencode", model: "anthropic/claude-3-5-sonnet" },
  },
  injectContext: true,
});

for await (const event of verify) {
  if (event.type === "text.delta") process.stdout.write(event.text);
}

await orchestrator.dispose();
```

---

## Appendix A: Quick Reference — Capability Matrix

| Capability | Claude | Codex | OpenCode |
|------------|:------:|:-----:|:--------:|
| TypeScript SDK | ✅ | ✅ | ✅ |
| Python SDK | ✅ | ❌ | ❌ |
| Streaming | ✅ | ✅ | ✅ |
| Buffered response | ❌ | ✅ | ✅ |
| Structured output | ❌ | ✅ | ✅ |
| Image input | ✅ | ✅ | ❌ |
| MCP servers | ✅ | ✅ | ✅ |
| Custom tools (native) | ✅ | ❌ | ✅ |
| Custom tools (MCP) | ✅ | ✅ | ✅ |
| Hooks/lifecycle | ✅ | ❌ | ❌ |
| Input modification | ✅ | ❌ | ❌ |
| Subagents (declarative) | ✅ | ❌ | ✅ |
| Subagents (manual) | ✅ | ✅ | ✅ |
| Session resume | ✅ | ✅ | ✅ |
| Session fork | ✅ | ✅ | ❌ |
| Session delete | ❌ | ❌ | ✅ |
| Session share | ❌ | ❌ | ✅ |
| Cost tracking | ✅ | ❌ | ❌ |
| Sandbox modes | ❌ | ✅ | ❌ |
| Turn steering | ❌ | ✅ | ❌ |
| Turn interrupt | ❌ | ✅ | ✅ |
| Permission remember | ❌ | ❌ | ✅ |
| Multi-provider | ❌ | ❌ | ✅ |
| Per-prompt model switch | ❌ | ❌ | ✅ |
| LSP integration | ❌ | ❌ | ✅ |
| App Server protocol | ❌ | ✅ | ❌ |
| HTTP server | ❌ | ❌ | ✅ |
| CI/CD mode | ❌ | ✅ | ❌ |
| Git requirement | ❌ | ✅ | ❌ |
| CORS support | ❌ | ❌ | ✅ |
| mDNS discovery | ❌ | ❌ | ✅ |

## Appendix B: Error Normalization

```typescript
type UnifiedError = {
  code: ErrorCode;
  message: string;
  framework: FrameworkId;
  raw?: unknown;
};

type ErrorCode =
  | "SESSION_NOT_FOUND"
  | "SESSION_EXPIRED"
  | "AUTH_FAILED"
  | "RATE_LIMITED"
  | "MAX_TURNS_REACHED"
  | "MAX_BUDGET_REACHED"
  | "TOOL_DENIED"
  | "TOOL_FAILED"
  | "STRUCTURED_OUTPUT_FAILED"
  | "FRAMEWORK_UNAVAILABLE"
  | "UNSUPPORTED_OPERATION"
  | "UNKNOWN";
```

## Appendix C: Decision Log

| Decision | Rationale |
|----------|-----------|
| `Part[]` as universal message format | All three use part-based messages; OpenCode uses `parts`, Codex uses arrays, Claude uses `content` arrays |
| Canonical tool names use `category.action` | Avoids collision with framework-specific casing; easy to map |
| `raw` escape hatch on config and responses | Lets users access framework-specific features without polluting the abstraction |
| MetaSession holds `SharedContext` separately | Framework sessions are isolated; context bridging is explicit, not magic |
| `injectContext` is opt-in per task | Prevents accidental context leakage; keeps tasks independent by default |
| Adapters are stateful (hold references) | Matches how all three SDKs work (Claude holds generators, Codex holds threads, OpenCode holds HTTP client) |
| `AdapterCapabilities` is a flat boolean map | Simple feature detection; no need for versioned capability negotiation yet |
| Plugin registration via `AdapterPlugin` | Enables third-party adapter packages without touching core |
| Context bridging uses text summarization | Token-efficient; avoids trying to serialize full conversation history across incompatible formats |

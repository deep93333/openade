# AgentIDE vs Claude Code vs Codex vs OpenCode

A feature-by-feature comparison of AgentIDE's agent against the three most popular open-source coding agents.

---

## Architecture Overview

| Dimension | AgentIDE | Claude Code | Codex (OpenAI) | OpenCode |
|-----------|----------|-------------|-----------------|----------|
| **Language** | TypeScript | TypeScript | TypeScript/Rust | Go |
| **Runtime** | Electron + Node.js | Node.js CLI + REPL | Node.js CLI + sandbox | Terminal (Go binary) |
| **LLM Integration** | Vercel AI SDK (multi-provider) | Anthropic SDK (Claude only) | OpenAI SDK (OpenAI only) | Direct HTTP to any provider |
| **Model Lock-in** | None — 13 models, 4 providers | Claude only | OpenAI only | None — any OpenAI-compatible API |
| **Agent Loop** | Custom (`streamText` + tool loop) | Custom (messages API + tool loop) | Custom (responses API + tool loop) | Custom (chat completions + tool loop) |
| **UI** | Electron GUI (React) | Terminal (ink) | Terminal (ink) | Terminal (bubbletea) |

### Key Architectural Difference

AgentIDE is the only one that owns the **full stack** — from Electron GUI to agent loop to model API calls — in a single codebase. Claude Code and Codex are CLIs that can be embedded but aren't full IDEs. OpenCode is a pure terminal app.

AgentIDE uses the **Vercel AI SDK** as its foundation, which means:
- Unified `streamText()` API across all providers
- Built-in token counting, usage tracking, abort signals
- Provider-specific features (like Anthropic cache control) via `providerOptions`
- Easy to add new providers (just install the `@ai-sdk/*` package)

---

## Agent Loop Comparison

### AgentIDE

```
streamText(model, system, messages, tools)
  → stream text deltas to UI
  → execute tool calls
  → append response messages to history
  → if finishReason === "tool-calls" → loop
  → if context overflow → compact → retry
  → if rate limit → backoff → retry
  → on complete → generate active memory
```

- Max 75 tool steps per run
- Proactive compaction at 70% context window
- Episode summarization every 20 messages / 15K tokens
- Tool output pruning every iteration (40K token threshold)
- Retry with exponential backoff (up to 10 attempts, max 30s)
- Parallel read-only sub-agents via `delegate` tool

### Claude Code

```
messages.create(model, system, messages, tools)
  → stream response blocks
  → execute tool calls (with permission checks)
  → append to history
  → if stop_reason === "tool_use" → loop
  → if context too long → compact with haiku
  → on complete → return
```

- Max configurable tool steps (default 200+)
- Compaction via Haiku when approaching limit
- Permission system (allow/deny per tool, auto-approve patterns)
- No episode summarization — relies on compaction only
- Built-in `git` awareness (auto-stash/restore)
- Extended thinking support (thinking blocks in messages)

### Codex (OpenAI)

```
responses.create(model, instructions, tools, previous_response_id)
  → stream response
  → execute tool calls (sandboxed)
  → if response contains tool calls → loop with previous_response_id
  → on complete → return
```

- Runs in Docker/seatbelt sandbox (file system, network restricted)
- Uses `previous_response_id` — server-side conversation continuation (no full replay)
- No explicit compaction — relies on server-side context management
- Three autonomy modes: suggest, auto-edit, full-auto
- Git worktree isolation (each task gets its own branch)

### OpenCode

```
chat.completions.create(model, messages, tools)
  → stream response chunks
  → execute tool calls
  → append to messages array
  → if tool_calls present → loop
  → manual compact command available
  → on complete → persist to SQLite
```

- Persistent conversation history in SQLite
- Manual `/compact` command to summarize and reduce context
- Provider-agnostic (OpenAI, Anthropic, Google, Ollama, etc.)
- LSP integration for diagnostics
- Session continuation across restarts (SQLite-backed)
- Custom key bindings and themes

---

## Context Management Deep Dive

| Strategy | AgentIDE (actual status) | Claude Code | Codex | OpenCode |
|----------|--------------------------|-------------|-------|----------|
| **Prompt caching** | Yes (Anthropic ephemeral) | Yes (Anthropic, server-side) | Yes (OpenAI, via `previous_response_id`) | Depends on provider |
| **Tool output pruning** | **Needs verification** — may be no-op due to message shape mismatch | No (relies on compaction) | N/A (server-managed) | No |
| **Episode summarization** | **Dead code** — generated but never injected into context | No | No | No |
| **Proactive compaction** | Yes (70% of context window) — but uses expensive model | Yes (configurable, uses cheap Haiku) | No (server-managed) | Manual (`/compact`) |
| **Reactive compaction** | Yes (on context overflow error) | Yes (on context overflow) | No | No |
| **Active memory** | **Partial** — only after successful non-aborted agent runs | No | No | No |
| **Long output offloading** | **Dead code** — built but never enabled (empty set) | No | N/A (sandbox has own FS) | No |
| **Conversation persistence** | **None** — in-memory only, lost on crash | File-based JSONL | Server-side | SQLite |
| **Cross-session context** | Active memory (when it works) or crude text dump | Full history replay (cached) | `previous_response_id` | SQLite history |

### Honest Assessment

**AgentIDE** — On paper, has 4 layers. In practice, compaction is the only fully working layer. Active memory works sometimes. Pruning needs verification. Episodes are dead code. Compaction also uses the expensive model instead of a cheap one. The real working strategy is: grow until 70% → compact with the user's model → hope the 4:1 char estimate was close enough.

**Claude Code** — Simplest approach and it works reliably. Relies on Anthropic's prompt caching (90% cost reduction on cached prefix) and only compacts when necessary. Uses Haiku (cheapest model) for compaction. Full conversation replay via JSONL for follow-ups. Boring but correct.

**Codex** — Offloads context management entirely to OpenAI's server via `previous_response_id`. Zero client-side complexity. Most token-efficient. Creates vendor lock-in.

**OpenCode** — Persists everything to SQLite. Manual `/compact` command puts the user in control. Simplest and most transparent.

---

## Tool Comparison

| Tool | AgentIDE | Claude Code | Codex | OpenCode |
|------|----------|-------------|-------|----------|
| Read file | `read` | `Read` | `read_file` | `read` |
| Write file | `write` | `Write` | `write_file` | `write` |
| Edit file | `edit` (string replace) | `Edit` (string replace) | `apply_diff` (unified diff) | `edit` (string replace) |
| Search content | `grep` (regex) | `Grep` (regex) | `grep` | `grep` (ripgrep) |
| Find files | `glob` | `Glob` | `glob` | `glob` |
| List directory | `ls` | `LS` | `list_directory` | `ls` |
| Shell command | `bash` | `Bash` | `shell` | `bash` |
| Delete file | `delete` | — | — | — |
| Lint check | `readlints` | — | — | `diagnostics` (LSP) |
| Task management | `todowrite` | `TodoWrite` | — | — |
| User question | `ask_question` | — | — | — |
| Sub-agents | `delegate` (parallel) | `Task` (parallel) | — | — |
| MCP tools | Yes (stdio, http, sse) | Yes (stdio) | Yes | Yes |

### Notable Differences

**AgentIDE's edit tool** uses exact string matching with uniqueness enforcement — the old string must appear exactly once. This is the same approach as Claude Code and OpenCode. Codex uses unified diff format (`apply_diff`), which is more powerful for multi-hunk edits but more error-prone (diff format is hard for models to produce correctly).

**AgentIDE's delegate tool** is analogous to Claude Code's `Task` tool. Both spawn parallel read-only sub-agents for codebase exploration. AgentIDE caps at 5 concurrent sub-agents with a 2-minute timeout each. Claude Code allows more concurrent tasks but has similar time limits.

**AgentIDE's readlints tool** — Neither Claude Code nor Codex have a dedicated lint tool. Claude Code relies on the model running linters via bash. OpenCode integrates with LSP for real-time diagnostics.

**AgentIDE's ask_question tool** — Unique to AgentIDE. Allows the agent to ask the user structured multiple-choice questions mid-task. Other frameworks rely on the model simply asking in prose.

---

## Sandboxing & Security

| Aspect | AgentIDE | Claude Code | Codex | OpenCode |
|--------|----------|-------------|-------|----------|
| **File system isolation** | None | None (permission system) | Docker/seatbelt sandbox | None |
| **Network isolation** | None | None | Restricted (allowlist) | None |
| **Command approval** | Optional (`canUseTool`) | Yes (per-tool permissions) | Autonomy modes | None |
| **Git safety** | Checkpoints (git stash) | Auto-stash/restore | Git worktree per task | None |
| **Directory restriction** | `workspacePath` only | `cwd` only | Sandbox mount | None |

### Key Gap: AgentIDE Has No Sandboxing

This is the most significant gap. The `bash` tool executes arbitrary commands in the user's project directory with no restrictions:

```typescript
spawn(args.command, {
  shell,
  cwd: ctx.workspacePath,
  env: { ...process.env },
  // No sandbox. Full system access.
});
```

Codex solves this with Docker containers or macOS seatbelt profiles that restrict file system access to the workspace directory and block network access. Claude Code uses a permission system where the user can approve/deny each tool use and configure auto-approve patterns.

AgentIDE has `canUseTool` callbacks for tool approval, but there's no file system restriction, no network restriction, and no process isolation.

---

## Session & Persistence

| Aspect | AgentIDE | Claude Code | Codex | OpenCode |
|--------|----------|-------------|-------|----------|
| **Session model** | In-memory per run | In-memory with file checkpoints | Server-side (`previous_response_id`) | SQLite persistent |
| **Conversation persistence** | UI-side (Zustand store) | JSONL files | Server-managed | SQLite |
| **Resume after restart** | Via active memory (summary) | Full history reload | Native (server ID) | Full history from SQLite |
| **Multi-thread support** | Yes (UI manages threads) | No (single session) | No (single task) | Yes (sessions in SQLite) |
| **Git checkpoints** | Yes (stash-based) | Yes (stash-based) | Yes (worktree-based) | No |

### AgentIDE's Active Memory Approach

When an agent run completes, AgentIDE generates a structured summary (active memory) of the session. On the next message in the same thread, this summary is injected as context instead of replaying the full conversation history. This is unique among the four frameworks and trades precision for token efficiency.

The tradeoff: active memory is a lossy compression of the full conversation. If the model's summary misses something important, the follow-up loses that context. Claude Code and OpenCode avoid this by replaying the full history (expensive but lossless).

---

## Multi-Provider Support

| Provider | AgentIDE | Claude Code | Codex | OpenCode |
|----------|----------|-------------|-------|----------|
| Anthropic (Claude) | 3 models | Full (native) | No | Via API |
| OpenAI | 6 models | No | Full (native) | Via API |
| MiniMax | 1 model | No | No | No |
| Moonshot (Kimi) | 3 models | No | No | Via API |
| Google (Gemini) | No | No | No | Via API |
| Ollama (local) | No | No | No | Yes |
| Any OpenAI-compatible | No | No | No | Yes |

AgentIDE supports the most providers out of the box (4), but OpenCode is the most flexible with its generic OpenAI-compatible API support and Ollama integration.

---

## Cost Tracking

| Aspect | AgentIDE | Claude Code | Codex | OpenCode |
|--------|----------|-------------|-------|----------|
| **Per-session cost** | Yes (with cache breakdown) | Yes | Limited | No |
| **Per-token breakdown** | Input, output, cache read, cache write | Input, output, cache | Input, output | No |
| **Dynamic pricing** | Yes (from models.dev) | No (hardcoded) | No (hardcoded) | No |
| **Cost display in UI** | Yes | Terminal display | Terminal display | No |

AgentIDE's dynamic pricing from `models.dev` is unique — pricing stays accurate without code changes when providers update their rates.

---

## System Prompt Approach

| Aspect | AgentIDE | Claude Code | Codex | OpenCode |
|--------|----------|-------------|-------|----------|
| **Dynamic project context** | Yes (tree + manifest + README) | Yes (git state + file listing) | Yes (file listing in sandbox) | No |
| **Mode-specific prompts** | 4 modes (agent, ask, plan, review) | 2 modes (default, extended thinking) | 3 autonomy levels | 1 mode |
| **Tool efficiency rules** | Extensive (anti-patterns, batching) | Moderate | Minimal | Minimal |
| **Compaction prompts** | Yes (structured template) | Yes | N/A | Yes |
| **Memory prompts** | Yes (episode + active memory) | No | No | No |

AgentIDE's system prompt is the most detailed, with explicit rules about tool efficiency (don't re-read files, batch searches, use grep not bash for search, etc.). This reduces token waste from inefficient tool use patterns.

---

## Summary: Strengths and Weaknesses

### AgentIDE — What's Actually Good
1. **Multi-provider, multi-model** — 13 models across 4 providers. Genuine advantage over Claude Code (Anthropic-only) and Codex (OpenAI-only).
2. **Full GUI** — Only framework with a native desktop app
3. **Dynamic pricing** — Auto-updated from models.dev. No one else does this.
4. **Mode system** — Agent, Ask, Plan, Review modes with appropriate tool restrictions
5. **System prompt quality** — Tool efficiency rules reduce wasteful tool calls
6. **Sub-agents** — Parallel read-only exploration (though uses expensive model)
7. **MCP support** — stdio, http, and sse transports

### AgentIDE — What's Broken or Missing
1. **Episode summarization is dead code** — Generated but never injected. Costs money for nothing.
2. **Long output offloading is dead code** — Built but never enabled.
3. **Tool approval is dead code** — Wired up but tools never call it.
4. **No conversation persistence** — Crash = total data loss. Claude Code has JSONL, OpenCode has SQLite.
5. **No sandboxing** — Bash has full system access. Codex has Docker, Claude Code has permissions.
6. **Compaction uses expensive model** — Claude Code uses Haiku. AgentIDE uses whatever the user picked.
7. **Active memory only works sometimes** — Not on abort, error, or non-agent modes.
8. **Pruning may be a no-op** — Needs verification against actual AI SDK message shapes.
9. **No extended thinking** — Claude Code supports thinking blocks.
10. **No git worktree isolation** — Codex creates isolated worktrees per task.

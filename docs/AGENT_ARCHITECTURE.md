# AgentIDE Agent Architecture

## Overview

AgentIDE's `@agentide/agent` package is a **self-contained agentic coding framework** built on top of the [Vercel AI SDK](https://sdk.vercel.ai). Unlike tools that wrap existing frameworks (Claude Code CLI, Codex CLI), AgentIDE owns the entire agent loop — tool execution, context management, streaming, and error recovery — and talks directly to model provider APIs.

```
┌──────────────────────────────────────────────────────────────┐
│  Electron App (UI)                                           │
│  apps/app → React + Zustand                                  │
│  apps/desktop → Electron main process                        │
└───────────────────────┬──────────────────────────────────────┘
                        │ IPC
┌───────────────────────▼──────────────────────────────────────┐
│  AgentManager                                                │
│  - Backend registry (Map<provider, AgentBackend>)            │
│  - Session lifecycle (start/stop, abort controllers)         │
│  - Provider capability queries                               │
└───────────────────────┬──────────────────────────────────────┘
                        │
┌───────────────────────▼──────────────────────────────────────┐
│  AgentBackend (custom-agent-backend.ts)                      │
│  - runAgent() — the core agent loop                          │
│  - streamText() via Vercel AI SDK                            │
│  - Tool execution + streaming output                         │
│  - Context management (episodes, compaction, active memory)  │
│  - Retry logic + error recovery                              │
│  - Cost tracking                                             │
└───────────────────────┬──────────────────────────────────────┘
                        │
┌───────────────────────▼──────────────────────────────────────┐
│  Vercel AI SDK (ai package)                                  │
│  @ai-sdk/anthropic │ @ai-sdk/openai │ minimax │ moonshot     │
└──────────────────────────────────────────────────────────────┘
```

---

## Source Files

| File | Lines | Purpose |
|------|-------|---------|
| `agent-manager.ts` | 194 | Session lifecycle, backend registry, multi-provider dispatch |
| `agent-backend-types.ts` | 57 | `AgentBackend`, `AgentBackendStartOptions`, `ProviderCapabilities` |
| `custom-agent-backend.ts` | 1040 | The core agent loop, compaction, active memory, title/commit generation |
| `models.ts` | 244 | 13 model definitions, dynamic pricing from models.dev, provider factory |
| `streaming.ts` | 219 | Token estimation, cost computation, retry logic, pruning, error extraction |
| `context-manager.ts` | 303 | Episode management, long output offloading, context debug info |
| `context.ts` | 91 | Project detection (tree, manifest, README) for system prompt |
| `system-prompt.ts` | 337 | Mode-specific system prompts (agent, ask, plan, review), compaction/memory prompts |
| `cache.ts` | 63 | Anthropic prompt caching (ephemeral cache control on stable prefix) |
| `sub-agent.ts` | 149 | Read-only sub-agents for parallel codebase exploration |
| `logger.ts` | 94 | Structured logging with file output support |
| `constants.ts` | 6 | Shared ignore directories |
| `tools/registry.ts` | 137 | Tool registration, wrapping, mode-specific tool sets |
| `tools/tool-types.ts` | 71 | `ToolContext`, `ToolDefinition`, `ToolResult` |
| `tools/*.ts` (12 files) | ~1200 | Individual tool implementations |

---

## Models & Providers

### Supported Models (13)

| Model | Provider | API | Context Window | Max Output |
|-------|----------|-----|----------------|------------|
| Claude Sonnet 4.6 | Anthropic | `claude-sonnet-4-6` | 200K | 64K |
| Claude Opus 4.6 | Anthropic | `claude-opus-4-6` | 200K | 128K |
| Claude Haiku 4.5 | Anthropic | `claude-haiku-4-5-20251001` | 200K | 64K |
| GPT-5.2 | OpenAI | `gpt-5.2` | 400K | 128K |
| GPT-5 Mini | OpenAI | `gpt-5-mini` | 400K | 128K |
| Codex 5.2 | OpenAI | `gpt-5.2-codex` | 400K | 128K |
| Codex 5.3 | OpenAI | `gpt-5.3-codex` | 400K | 128K |
| GPT 5.4 | OpenAI | `gpt-5.4-2026-03-05` | 1.05M | 128K |
| Codex 5.1 Mini | OpenAI | `gpt-5.1-codex-mini` | 400K | 128K |
| MiniMax M2.5 | MiniMax | `MiniMax-M2.5` | 204K | 131K |
| Kimi K2.5 | Moonshot | `kimi-k2.5` | 128K | 64K |
| Kimi K2 | Moonshot | `kimi-k2` | 128K | 64K |
| Kimi K2 Thinking | Moonshot | `kimi-k2-thinking` | 128K | 64K |

### Dynamic Pricing

Pricing is fetched from `models.dev/api.json` at agent start and cached for 24 hours. This keeps cost tracking accurate without hardcoded values going stale. Fallback to static pricing if the fetch fails.

### Model Resolution

```
User selects model → resolveModel(value) → ModelDef
                   → createLanguageModel(modelDef, config) → LanguageModel
                   → dispatched to correct SDK provider
```

---

## Agent Loop

### Core Flow (`runAgent` in `custom-agent-backend.ts`)

```
1.  Resolve model → ModelDef
2.  Build system prompt (environment + project context + mode-specific instructions)
3.  Create abort controller chain (external + internal)
4.  Initialize MCP tool runtimes
5.  Build conversation history (context seed from prior messages or active memory)
6.  Add user prompt + image attachments
7.  Enter agent loop:
    │
    ├─ Check if episode creation is needed
    │   └─ If yes → generate episode summary, add to context manager
    │
    ├─ Check if proactive compaction is needed (>70% context window)
    │   └─ If yes → compact older messages, keep recent 30K tokens
    │
    ├─ Prune conversation (clear old tool outputs above 40K token threshold)
    │
    ├─ streamText() → model API call
    │   ├─ Stream text deltas → onMessage (partial)
    │   ├─ Tool calls → execute → onMessage (tool result)
    │   └─ Track usage (input/output/cache tokens)
    │
    ├─ Append response messages to conversation history
    │
    ├─ If finishReason === "tool-calls" → continue loop
    ├─ If context overflow error → compact and retry
    ├─ If rate limit → exponential backoff retry (up to 10 attempts)
    ├─ If aborted → break
    └─ Otherwise → break (done)

8.  Close MCP runtimes
9.  Generate active memory (end-of-session summary)
10. Report final result (cost, tokens, active memory)
```

### Modes

| Mode | Tools Available | Purpose |
|------|----------------|---------|
| `agent` | All 12 tools + delegate + MCP | Full autonomous coding |
| `ask` | Read-only (read, grep, glob, ls, readlints) + MCP | Answer questions without modifications |
| `plan` | Read-only + todowrite + ask_question + MCP | Explore and produce implementation plans |
| `agent_review` | Read-only + MCP | Review thread work against original request |

---

## Tools

### Full Tool Set (Agent Mode)

| Tool | File | Purpose |
|------|------|---------|
| `bash` | `bash.ts` | Execute shell commands (git, builds, tests) |
| `read` | `read.ts` | Read file contents with offset/limit pagination |
| `write` | `write.ts` | Create new files or full rewrites |
| `edit` | `edit.ts` | Surgical string replacement in files |
| `delete` | `delete.ts` | Delete files |
| `glob` | `glob.ts` | Find files by pattern (auto-excludes build dirs) |
| `grep` | `grep.ts` | Search file contents with regex (auto-excludes build dirs) |
| `ls` | `ls.ts` | List directory contents |
| `readlints` | `readlints.ts` | Check lint/type errors |
| `todowrite` | `todowrite.ts` | Create/manage task lists |
| `ask_question` | `ask-question.ts` | Ask user structured questions |
| `delegate` | `delegate.ts` | Run parallel read-only sub-agents |

### Read-Only Tool Set (Ask/Review Modes)

`read`, `glob`, `grep`, `ls`, `readlints`

### Planning Tool Set (Plan Mode)

`read`, `glob`, `grep`, `ls`, `readlints`, `todowrite`, `ask_question`

### Tool Execution Flow

```
Model requests tool call
  → wrapTool intercepts
  → ctx.onToolStart fires (UI shows "running" state)
  → def.execute(args, ctx) runs the actual tool
  → Optional: long output offloaded to file via contextManager
  → onToolCall fires (UI shows "completed" state with result)
  → Result returned to model
```

### Tool Approval

When `canUseTool` is provided, the agent pauses before executing and asks the UI for permission:

```typescript
const result = await options.canUseTool(sessionId, toolName, input);
if (result.behavior === "deny") → tool returns denial message
if (result.behavior === "allow") → tool executes (optionally with modified input)
```

---

## Context Management

> **Honest status**: Only compaction fully works. Pruning needs verification. Active memory is partial. Episodes and offloading are dead code. See `HONEST_REVIEW.md` for details.

### Conversation Pruning — STATUS: NEEDS VERIFICATION

**When**: Every iteration of the agent loop, before sending to model.

**What**: Intended to scan tool result messages and clear old ones beyond a 40K token threshold. Replaces content with `[Old tool result content cleared]`.

**Known issue**: Only handles tool messages where `content` is an array with objects containing an `"output"` field. If the Vercel AI SDK stores tool results differently, this is a no-op. Needs verification against actual message shapes.

### Full Compaction — STATUS: WORKS (with cost issue)

**When**: Proactively at 70% of context window, or reactively on context overflow error.

**What**: Splits conversation into "older" and "recent" (most recent 30K tokens). Sends older messages to the model with `COMPACTION_PROMPT`. Gets back a structured summary. Replaces older messages with the summary.

**Known issue**: Uses the user's selected model (e.g., Opus at $5/1M) instead of a cheap model (Haiku at $1/1M). 5x more expensive than necessary. Claude Code uses Haiku for compaction.

### Active Memory — STATUS: PARTIAL

**When**: After a successful, non-aborted agent-mode run only.

**What**: Generates a structured summary of the session. Injected into the next follow-up message.

**Known issues**: Not generated on abort (most common for long tasks), error, or ask/plan modes. Most follow-ups fall through to a crude text dump.

### Episode Summarization — STATUS: DEAD CODE (marked for removal)

Episodes are generated (costing API calls) but `buildContextWithEpisodes()` is never called from the agent loop. The summaries sit in memory and are never injected into context.

### Long Output Offloading — STATUS: DEAD CODE (needs enabling or removal)

Infrastructure exists in `context-manager.ts` but `TOOLS_TO_FILE_ON_LONG_OUTPUT` is an empty Set. The `initContextManager` also doesn't create the target directory.

---

## Prompt Caching

`cache.ts` implements Anthropic-style prompt caching:

1. Counts the "stable prefix" — consecutive user/assistant messages from the start of the conversation
2. Adds `providerOptions: { anthropic: { cacheControl: { type: "ephemeral" } } }` to all stable prefix messages
3. Only applies to Anthropic models (detected via provider/model ID)

This means the system prompt + early conversation messages get cached. Follow-up calls pay 1/10th the input cost for the cached prefix.

---

## Error Recovery

### Retry Logic

| Error Type | Strategy |
|-----------|----------|
| Rate limit (429, 503, 529) | Exponential backoff, respects `retry-after` / `retry-after-ms` headers. Max 10 attempts, max 30s delay. |
| Context overflow | Trigger compaction, retry with compacted context. If compaction fails, abort. |
| Abort signal | Clean exit, no retry. |
| Other errors | Extract readable error message, report to UI, stop. |

### Error Message Extraction

`extractApiErrorMessage` handles multiple error shapes:
- `data.error.message` (Anthropic format)
- `responseBody` JSON parse → `error.message`
- `err.message` (standard Error)
- Falls back to JSON.stringify or String()

---

## Sub-Agents

The `delegate` tool runs parallel read-only sub-agents for codebase exploration:

```
Main agent calls delegate with up to 5 tasks
  → Each task spawns a runSubAgent()
  → Each sub-agent gets: read, grep, glob, ls, readlints tools
  → Each sub-agent gets its own abort controller + 2min timeout
  → All run in parallel via Promise.allSettled
  → Results aggregated and returned to main agent
```

Sub-agents cannot modify files. They share the same language model and system prompt as the parent.

---

## Cost Tracking

Cost is computed per `streamText` call:

```
cost = (uncachedInput × inputRate
      + cacheRead × cacheReadRate
      + cacheWrite × cacheWriteRate
      + output × outputRate) / 1,000,000
```

Tracked per session: `totalCostUsd`, `totalInputTokens`, `totalOutputTokens`, `totalCacheReadTokens`, `totalCacheWriteTokens`. Reported via `onResult` at session end.

---

## System Prompt

Built dynamically per session from three parts:

1. **Environment** — OS, shell, home dir, working directory, current date
2. **Project Context** — Auto-detected: shallow directory tree (2 levels), first project manifest (package.json, Cargo.toml, etc.), README excerpt
3. **Mode Instructions** — Role, available tools, guidelines, output format

### Mode-Specific Prompts

| Mode | Role | Key Instructions |
|------|------|-----------------|
| Agent | Expert coding assistant | Tool efficiency rules, code quality standards, workflow guidelines |
| Ask | Knowledgeable assistant | Read-only exploration, explain with file references |
| Plan | Software architect | Explore → plan → structured output format |
| Review | Code reviewer | 8-point checklist, verdict (PASS/PARTIAL/FAIL), evidence-based findings |

---

## Session Lifecycle

```
1. User sends prompt via Electron UI
2. Desktop IPC handler calls agentManager.start()
3. AgentManager creates AbortController, generates sessionId
4. AgentManager calls backend.start(options)
5. backend.start → runAgent() — async, runs the agent loop
6. During execution:
   - onMessage callbacks stream to UI (partial text, tool calls, system messages)
   - onError callbacks report errors to UI
7. On completion:
   - Active memory generated (if agent mode, not aborted)
   - onResult called with cost/token summary
   - Session status set to "idle"
8. User sends follow-up → step 2 with existingMessages or activeMemory
9. User clicks stop → agentManager.stop(sessionId) → abort controller fires
```

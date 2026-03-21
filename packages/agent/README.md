# @agentide/agent

AI agent runtime for AgentIDE. Handles LLM streaming, tool execution, session management, context compaction, and system prompt generation. Provider-agnostic — supports Anthropic, OpenAI, and MiniMax via the Vercel AI SDK.

## Architecture

```
                         ┌──────────────────────────────────┐
                         │    Electron Desktop (IPC host)    │
                         │  createCustomAgentBackend(config) │
                         │  createAgentManager({ backends }) │
                         └───────────────┬──────────────────┘
                                         │
                    ┌────────────────────┼────────────────────┐
                    ▼                    ▼                    ▼
           ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
           │ AgentManager  │    │ system-prompt │    │   models.ts  │
           │ start / stop  │    │ mode-specific │    │ provider SDK │
           │ status / list │    │ prompt build  │    │ model catalog│
           └──────┬───────┘    └──────────────┘    └──────────────┘
                  │
                  ▼
           ┌──────────────────────────────────────────────────┐
           │          runAgent (custom-agent-backend.ts)       │
           │                                                   │
           │  ┌─ Build system prompt (context + env + mode)    │
           │  ├─ Create tool set (agent / plan / ask)          │
           │  ├─ Summarize existing messages (if resuming)     │
           │  ├─ Stream loop:                                  │
           │  │   ├─ pruneConversation (clear old tool output) │
           │  │   ├─ addCacheControl (Anthropic prompt cache)  │
           │  │   ├─ streamText → tool calls → append history  │
           │  │   └─ repeat until finish or abort              │
           │  ├─ On context overflow → compactConversation     │
           │  └─ On rate limit → exponential backoff retry     │
           └──────────────────────────┬───────────────────────┘
                                      │
              ┌───────────┬───────────┼───────────┬───────────┐
              ▼           ▼           ▼           ▼           ▼
        ┌──────────┐ ┌────────┐ ┌─────────┐ ┌────────┐ ┌─────────┐
        │ Built-in │ │delegate│ │  MCP    │ │ cache  │ │streaming│
        │  tools   │ │sub-agt │ │  tools  │ │ ctrl   │ │ helpers │
        └──────────┘ └────────┘ └─────────┘ └────────┘ └─────────┘
```

### Source Layout

```
src/
├── index.ts                  # Public API — re-exports everything consumers need
├── custom-agent-backend.ts   # Agent backend: runAgent loop, title/commit generation
├── agent-manager.ts          # Session pool: start/stop/status across backends
├── agent-backend-types.ts    # Core types: AgentBackend, StartOptions, ToolApproval
├── models.ts                 # Model catalog, provider SDK factory, API key resolution
├── system-prompt.ts          # System prompt builder for agent/plan/ask/agent_review
├── context.ts                # Workspace scanner: project tree, manifest, README
├── streaming.ts              # Token estimation, cost, retry, pruning, overflow detection
├── cache.ts                  # Anthropic prompt caching (ephemeral cache control)
├── sub-agent.ts              # Read-only sub-agents for parallel research (delegate)
├── constants.ts              # Shared constants (IGNORE_DIRS)
├── logger.ts                 # Agent logger, file logger, event formatting
└── tools/
    ├── registry.ts           # Tool registry: wrapTool, createToolSet, createReadOnlyToolSet
    ├── tool-types.ts         # ToolContext, ToolResult, ToolDefinition, truncateOutput
    ├── bash.ts               # Shell command execution
    ├── read.ts               # File reading with offset/limit pagination
    ├── write.ts              # File creation / overwrite
    ├── edit.ts               # Surgical string replacement in files
    ├── glob.ts               # Find files by pattern (recursive, auto-excludes build dirs)
    ├── grep.ts               # Regex search across file contents
    ├── ls.ts                 # Directory listing
    ├── delete.ts             # File deletion
    ├── readlints.ts          # Lint/type error checking
    ├── todowrite.ts          # Structured task list management
    ├── ask-question.ts       # Structured multi-choice user input
    ├── delegate.ts           # Parallel read-only sub-agent orchestration
    └── mcp.ts                # MCP server runtime: create, merge, close, validate
```

---

## Tech Stack & Dependencies

| Package | Version | Purpose |
|---|---|---|
| `ai` | ^6.0.103 | Vercel AI SDK — `streamText`, `tool`, `stepCountIs`, `zodSchema` |
| `@ai-sdk/anthropic` | ^3.0.47 | Anthropic provider (Claude models) |
| `@ai-sdk/openai` | ^3.0.35 | OpenAI provider (GPT / Codex models) |
| `@ai-sdk/mcp` | ^1.0.16 | MCP tool integration |
| `vercel-minimax-ai-provider` | ^0.0.2 | MiniMax provider |
| `@agentide/shared` | workspace:* | Shared types (AgentMessage, AgentMode, MCPServerConfig) |
| `zod` | ^4.3.6 | Schema validation for tool parameters |
| `ulid` | ^3.0.1 | Sortable unique IDs for messages and tool calls |

**Build:** TypeScript compiler (`tsc`) only — no bundler. ESM output, ES2022 target, strict mode.

---

## Monorepo Context

```
agentide/
├── apps/
│   ├── app/        # Vite + React UI (imports @agentide/shared + @agentide/ui, NOT agent)
│   └── desktop/    # Electron shell — imports @agentide/agent, wires IPC ↔ agent manager
└── packages/
    ├── agent/      # This package — agent backend, tools, streaming
    ├── shared/     # Shared types and constants
    └── ui/         # Shared UI components
```

The agent runs in the **Electron main process**. The React app communicates with it over IPC. The app layer never imports `@agentide/agent` directly — it only uses shared types.

---

## LLM Providers & Models

Three providers, resolved at runtime via `createLanguageModel(modelDef, config)`:

| Model | Provider | API Model ID | Context | Max Output | Input $/M | Output $/M |
|---|---|---|---|---|---|---|
| Sonnet 4.6 | Anthropic | `claude-sonnet-4-6` | 200k | 64k | $3 | $15 |
| Opus 4.6 | Anthropic | `claude-opus-4-6` | 200k | 128k | $5 | $25 |
| Haiku 4.5 | Anthropic | `claude-haiku-4-5-20251001` | 200k | 64k | $1 | $5 |
| GPT-5.2 | OpenAI | `gpt-5.2` | 400k | 128k | $1.75 | $14 |
| GPT-5 Mini | OpenAI | `gpt-5-mini` | 400k | 128k | $0.25 | $2 |
| Codex 5.2 | OpenAI | `gpt-5.2-codex` | 400k | 128k | $1.75 | $14 |
| Codex 5.3 | OpenAI | `gpt-5.3-codex` | 400k | 128k | $1.75 | $14 |
| GPT 5.4 | OpenAI | `gpt-5.4-2026-03-05` | 1.05M | 128k | $2.50 | $15 |
| Codex 5.1 Mini | OpenAI | `gpt-5.1-codex-mini` | 400k | 128k | $0.25 | $2 |
| MiniMax M2.5 | MiniMax | `MiniMax-M2.5` | 204k | 131k | $0.30 | $1.20 |

### Model Registry & Pricing

Each model is defined in the `MODELS` array in `models.ts` with `value`, `label`, `llmProvider`, `apiModelId`, `uiProvider`, `contextWindowTokens`, `maxOutputTokens`, and `pricing` (input/output/cache rates per 1M tokens).

**Live pricing via [models.dev](https://models.dev):** On each agent run, `refreshModelPricing()` fetches the latest model data from `https://models.dev/api.json` and updates context windows, output limits, and pricing in-place. The data is cached for 24 hours. Hardcoded defaults serve as fallbacks if the fetch fails.

The lookup uses the `apiModelId` to match against the models.dev registry. For date-suffixed models (e.g., `gpt-5.4-2026-03-05`), it falls back to the base ID (e.g., `gpt-5.4`).

API keys are resolved per-provider via `AgentBackendConfig`:
- `getApiKey()` → Anthropic
- `getCodexApiKey()` → OpenAI
- `getMinimaxApiKey()` → MiniMax
- `getMoonshotApiKey()` → Moonshot AI

---

## Agent Execution Loop

### Session Lifecycle

```
createAgentManager({ backends })
    │
    ├── manager.start(options)
    │       → creates AbortController
    │       → resolves provider backend
    │       → calls backend.start(options) (async, non-blocking)
    │       → returns sessionId
    │
    ├── manager.stop(sessionId)
    │       → aborts controller, cleans up session
    │
    └── manager.getStatus() / getModels()
```

### runAgent Loop (custom-agent-backend.ts)

```
runAgent(config, options)
    │
    ├── resolveModel(options.model)
    ├── createLanguageModel(modelDef, config)
    ├── buildSystemPrompt(workspacePath, mode)
    ├── createMCPToolRuntimes(mcpServers)
    │
    ├── buildContextSeed(activeMemory, existingMessages)  ← activeMemory preferred
    ├── Append user prompt + image attachments
    │
    ├── Select tool set based on mode:
    │   ├── agent       → createToolSet (12 tools) + delegate (if subAgent)
    │   ├── plan        → createPlanningToolSet (7 tools)
    │   └── ask/review  → createReadOnlyToolSet (5 tools)
    │
    └── Stream loop:
        ├── Proactive compaction check (>70% context window)
        ├── pruneConversation(conversationHistory)      ← clear stale tool output
        ├── addCacheControl({ messages, model })        ← Anthropic prompt caching
        ├── streamText({ model, system, messages, tools, stopWhen })
        ├── Stream text deltas → onMessage(isPartial: true)
        ├── Tool calls → execute → onMessage(toolResult)
        ├── Final text → onMessage(isPartial: false)
        ├── Append response.messages to conversationHistory
        │
        ├── finishReason === "tool-calls" → continue loop
        ├── Context overflow → smart compaction (preserve recent) → retry
        ├── Rate limit (429/503/529) → exponential backoff → retry
        ├── Completion → generateActiveMemory() → save to thread
        └── onResult({ cost, tokens, activeMemory })
```

### Modes

| Mode | Role | Tools | Max Steps |
|---|---|---|---|
| `agent` | Full coding assistant | 12 built-in + MCP + delegate | 75 |
| `plan` | Architecture planning | read, glob, grep, ls, readlints, todowrite, ask_question + MCP | 20 |
| `ask` | Q&A about code | read, glob, grep, ls, readlints + MCP | 20 |
| `agent_review` | Code review | read, glob, grep, ls, readlints + MCP | 20 |

---

## Tool System

### Architecture

Every tool is a `ToolDefinition`:

```typescript
type ToolDefinition<T extends z.ZodType = z.ZodType> = {
  id: string;
  description: string;
  parameters: T;              // Zod schema
  execute: (args: z.infer<T>, ctx: ToolContext) => Promise<ToolResult>;
};
```

`wrapTool(def, ctx, onToolCall)` converts a `ToolDefinition` into the Vercel AI SDK `tool()` format:
1. Generates a `toolCallId` (ULID)
2. Calls `ctx.onToolStart` (emits "running" status to UI)
3. Executes `def.execute(args, ctx)`
4. Calls `onToolCall` callback (emits "completed" status with result)
5. Returns `result.output` to the LLM

### ToolContext

Shared context passed to every tool execution:

```typescript
type ToolContext = {
  sessionId: string;
  workspacePath: string;
  abortSignal: AbortSignal;
  onMetadata: (meta: Record<string, unknown>) => void;
  requestUserInput: (toolName: string, input: unknown) => Promise<UserInputResponse>;
  onToolStart?: (meta: ToolStartMeta) => void;
  subAgent?: SubAgentCapability;     // present in agent mode only
  mcpTools?: MCPToolRuntime[];       // MCP server tool runtimes
};
```

### Built-in Tools

| Tool | ID | Mode Availability | Purpose |
|---|---|---|---|
| bash | `bash` | agent | Shell command execution (git, builds, scripts) |
| read | `read` | all | File reading with offset/limit pagination |
| write | `write` | agent | File creation / complete overwrite |
| edit | `edit` | agent | Surgical string replacement in files |
| glob | `glob` | all | Find files by pattern, auto-excludes build dirs |
| grep | `grep` | all | Regex search across file contents |
| ls | `ls` | all | Directory listing |
| delete | `delete` | agent | File deletion |
| readlints | `readlints` | all | Lint/type error checking |
| todowrite | `todowrite` | agent, plan | Structured task list management |
| ask_question | `ask_question` | agent, plan | Multi-choice user input via `requestUserInput` |
| delegate | `delegate` | agent (when subAgent set) | Run parallel read-only sub-agents |

### MCP Tools

External tools from MCP (Model Context Protocol) servers are dynamically loaded and merged into the tool set:

1. `createMCPToolRuntimes(mcpServers)` — starts MCP server connections
2. `mergeMCPTools(baseTools, runtimes)` — merges MCP tools into the base `ToolSet`
3. `closeMCPToolRuntimes(runtimes)` — shuts down connections at session end

### Sub-Agents (delegate)

The `delegate` tool spawns read-only sub-agents that run in parallel:

- Each sub-agent gets its own `streamText` loop with read-only tools (read, glob, grep, ls, readlints)
- Max 15 steps per sub-agent, 120s timeout
- Cannot modify files — only explore and report back
- Uses the parent's `languageModel` and `systemPrompt` with a research-focused preamble
- Up to 5 concurrent tasks per delegate call
- Returns structured `SubAgentResult` with status, output, and token usage

---

## Active Memory & Context Management

The agent uses a multi-layer memory system: **active memory** for cross-run persistence, **proactive compaction** to prevent context overflow, and **smart compaction** that preserves recent context.

### Active Memory (Cross-Run Persistence)

Each thread has an `activeMemory` field — a structured summary generated at the end of each agent run. On the next run in the same thread, this replaces the lossy message summarization:

```
Run 1 completes → generateActiveMemory() → stored on ChatThread.activeMemory
Run 2 starts    → activeMemory injected as context seed (instead of summarizing raw messages)
Run 3 starts    → updated activeMemory from Run 2 used as seed
```

The active memory captures:
- User's primary goal and sub-goals
- Key instructions, preferences, and constraints
- Codebase knowledge discovered (architecture, patterns, gotchas)
- What was accomplished (with specific file paths)
- What remains to be done
- Key files and their roles

Generated via `ACTIVE_MEMORY_PROMPT` using the same model, capped at 2,000 output tokens with a 30s timeout. Only generated in **agent** mode after successful runs.

**Fallback:** If no `activeMemory` exists (first run), falls back to the legacy `buildContextSeed()` which summarizes `existingMessages` as `[Role]: content` pairs (assistant capped at 2k chars, tool at 800 chars).

### Layer 1: Tool Output Truncation (preventive)

Individual tool outputs are capped at **30,000 characters**:

```typescript
function truncateOutput(output: string, max = 30_000): string {
  if (output.length <= max) return output;
  return output.slice(0, max) + TRUNCATION_NOTICE;
}
```

Applied by: read, grep, bash, delegate, glob, readlints.

### Layer 2: Conversation Pruning (per-step)

Before every `streamText` call, `pruneConversation()` scans tool messages:

- **Trigger:** Total tool tokens > 60k (`PRUNE_PROTECT_TOKENS + PRUNE_MIN_SAVINGS`)
- **Action:** Keep the most recent ~40k tokens of tool results; replace older tool content with `"[Old tool result content cleared]"`
- **Scope:** Only `role: "tool"` messages — user/assistant/system untouched
- **Estimation:** `estimateTokens(text) = Math.ceil(text.length / 4)`

```
Tool messages (newest → oldest):
  [tool A: 15k tokens]  ← kept (within 40k budget)
  [tool B: 20k tokens]  ← kept (35k cumulative)
  [tool C: 10k tokens]  ← PRUNED (would exceed 40k)
  [tool D: 25k tokens]  ← PRUNED
```

### Layer 3: Proactive Compaction (pre-emptive)

Before each `streamText` call in agent mode, the estimated conversation token count is checked against the model's context window:

- **Trigger:** `estimateConversationTokens(history) > contextWindowTokens * 0.70`
- **Action:** Run `compactConversation()` before hitting the API
- Prevents the scenario where the compaction request itself overflows

Each model now has a `contextWindowTokens` field in its `ModelDef` (e.g., 200k for Claude, 128k for GPT).

### Layer 4: Smart Compaction (preserves recent context)

When compaction runs (proactively or reactively), it **preserves the most recent ~30k tokens** of conversation and only summarizes older history:

```
Before compaction:
  [msg 1] [msg 2] ... [msg 50] [msg 51] ... [msg 80]
  ╰─── older (summarized) ───╯  ╰─── recent (kept) ──╯

After compaction:
  [assistant: summary of msgs 1-50]
  [user: "Continue. The above is a summary of the earlier part."]
  [msg 51] ... [msg 80]  ← preserved as-is
```

`splitForCompaction(messages, keepRecentTokens)` walks backward from the end, accumulating tokens until the `COMPACTION_KEEP_RECENT_TOKENS` (30k) budget is reached. Everything before the split is summarized; everything after is kept verbatim.

If the conversation is too short to split (≤2 messages older), the entire conversation is compacted as before.

### Layer 5: Reactive Overflow Detection (fallback)

When the LLM API returns a context-too-long error, `isContextOverflow()` matches against known error patterns and triggers compaction as a last resort:

```
/prompt is too long/i
/exceeds the context window/i
/input token count.*exceeds the maximum/i
/maximum context length/i
/context[_ ]length[_ ]exceeded/i
/reduce the length of the messages/i
```

> Compaction is only available in **agent** mode. Plan/ask/review modes surface context overflow as a terminal error.

### Layer 6: Project Context Limits

`detectProjectContext()` auto-truncates workspace context injected into the system prompt:
- Project tree: max 40 lines
- Manifest file (package.json, etc.): max 20 lines
- README excerpt: max 20 lines

---

## Prompt Caching (Anthropic)

`addCacheControl()` in `cache.ts` adds `cacheControl: { type: "ephemeral" }` to the **stable prefix** of messages:

1. Walk messages from the start
2. Count consecutive `user` / `assistant` messages (stop at first `tool` or `system`)
3. Add `providerOptions.anthropic.cacheControl` to each message in the prefix
4. Only activates for Anthropic models (checked via `isAnthropicModel()`)

Applied via `prepareStep` on every `streamText` call — both in the main agent loop and sub-agents.

**Cost impact:** Cached read tokens cost 10% of base input rate; cache write tokens cost 125% of base input rate.

---

## Error Handling & Retry

### Retryable Errors

`parseRetryDelay()` handles HTTP 429, 503, 529, and `isRetryable: true`:

| Attempt | Default Delay |
|---|---|
| 1 | 2s |
| 2 | 4s |
| 3 | 8s |
| 4 | 16s |
| 5+ | 30s (max) |
| 10+ | Give up |

Respects `retry-after-ms` and `retry-after` response headers when present.

### API Error Extraction

`extractApiErrorMessage()` handles multiple error shapes:
- `data.error.message` (structured API errors)
- `responseBody` (JSON parse fallback)
- `error.message` (standard Error)
- JSON stringification fallback (capped at 500 chars)

---

## Cost Tracking

`computeCost()` calculates per-session cost from `LanguageModelUsage`:

- Uses per-model `pricing` from `ModelDef.pricing` (per 1M tokens rates for input, output, cache read, cache write)
- Pricing auto-updated from models.dev on each run (see Model Registry above)
- Cache-aware for all providers: uncached tokens at `inputPer1M`, cached reads at `cacheReadPer1M` (fallback: 10% of input), cache writes at `cacheWritePer1M` (fallback: 125% of input)

Totals (`inputTokens`, `outputTokens`, `cacheReadTokens`, `cacheWriteTokens`, `totalCostUsd`) are accumulated across all `streamText` calls in a session and reported via `onResult`.

---

## System Prompt Construction

`buildSystemPrompt(workspacePath, mode)` assembles the system prompt:

1. **Project context** — `detectProjectContext()` scans workspace for tree, manifest, README
2. **Environment** — OS, shell, home directory, working directory, current date
3. **Mode-specific instructions:**
   - **agent** — tool efficiency guidelines, code quality rules, workflow patterns, delegate usage, file operation rules
   - **plan** — architect role, planning-only tools, structured plan output format (Goal → Steps → Files Affected → Risks)
   - **ask** — Q&A role, read-only tools, reference-heavy answers
   - **agent_review** — code review role, 8-point checklist, PASS/PARTIAL/FAIL verdict format

---

## Utility Helpers

### Thread Title Generation

`generateThreadTitle(config, params)`:
- Extracts first user message + last assistant message + first tool name
- Sends to the same model with `maxOutputTokens: 40`, `temperature: 0.2`
- Cleans result: strips quotes, collapses whitespace, removes trailing punctuation, caps at 80 chars

### Commit Message Generation

`generateCommitMessage(config, params)`:
- Takes file list with diffs, caps at 12 files
- Patches capped at 1,200 chars each, 4,000 total
- Same LLM call pattern, cleans to 72 chars max
- Imperative style prompt: "Add", "Fix", "Refactor", etc.

---

## Adding a New Tool

1. Create `src/tools/yourtool.ts`:

```typescript
import { z } from "zod";
import type { ToolDefinition, ToolResult } from "./tool-types.js";

export const yourTool: ToolDefinition = {
  id: "yourtool",
  description: "What this tool does",
  parameters: z.object({
    param: z.string().describe("Parameter description"),
  }),
  execute: async (args, ctx) => {
    return { title: "Short title", output: "result text", metadata: {} };
  },
};
```

2. Register in `src/tools/registry.ts`:

```typescript
import { yourTool } from "./yourtool.js";

// Add to the appropriate createToolSet function:
yourtool: wrapTool(yourTool, ctx, onToolCall),
```

3. Re-export types if needed from `src/index.ts`.

## Adding a New Model

Add an entry to the `MODELS` array in `src/models.ts`:

```typescript
{
  value: "model-id",
  label: "Display Name",
  llmProvider: "anthropic",        // or "openai" | "minimax"
  apiModelId: "api-model-id",      // must match models.dev ID for auto-pricing
  uiProvider: "claude",            // or "codex" | "minimax"
  contextWindowTokens: 200_000,
  maxOutputTokens: 64_000,
  pricing: {
    inputPer1M: 3,                 // $/1M input tokens
    outputPer1M: 15,               // $/1M output tokens
    cacheReadPer1M: 0.3,           // optional — $/1M cached read tokens
    cacheWritePer1M: 3.75,         // optional — $/1M cached write tokens
  },
}
```

If the `apiModelId` matches an entry in [models.dev](https://models.dev/api.json), pricing and limits will be auto-updated at runtime.

---

## Public API

```typescript
import {
  // Session management
  createAgentManager,
  type AgentManager,
  type AgentManagerOptions,

  // Agent backend
  createCustomAgentBackend,
  generateThreadTitle,
  generateCommitMessage,
  refreshModelPricing,
  type AgentBackendConfig,
  type ModelDef,
  type ModelPricing,

  // Types
  type AgentBackend,
  type AgentBackendStartOptions,
  type ToolApprovalResult,
  type ModelOption,
  type ProviderCapabilities,

  // System prompt
  buildSystemPrompt,
  COMPACTION_PROMPT,
  ACTIVE_MEMORY_PROMPT,

  // Cache
  addCacheControl,

  // Tools
  createToolSet,
  createPlanningToolSet,
  getToolIds,
  type ToolCallMetadata,
  type ToolContext,
  type ToolResult,
  type ToolDefinition,
  type SubAgentCapability,
  type MCPToolRuntime,

  // Sub-agent
  type SubAgentTask,
  type SubAgentResult,

  // Logging
  createAgentLogger,
  logAgentEvent,
  createFileAgentLogger,
  formatAgentLogEntry,
  type AgentLogger,
  type AgentLogEntry,
  type AgentLogLevel,
  type AgentLogWriter,
  type FileAgentLoggerOptions,
} from "@agentide/agent";
```

## Scripts

| Command | Description |
|---|---|
| `bun run build` | Compile TypeScript with tsc |
| `bun run dev` | Watch mode compilation |
| `bun run clean` | Remove dist/ |

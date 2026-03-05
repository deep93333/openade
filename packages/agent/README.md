# @agentide/agent

AI agent runtime for AgentIDE. Handles LLM streaming, tool execution, session management, and system prompt generation. Provider-agnostic — supports Anthropic, OpenAI, and MiniMax.

## Architecture

```
src/
├── index.ts         # Public API — re-exports everything consumers need
├── runner.ts        # Agent execution loop (LLM streaming, tool calls, compaction, title generation)
├── sessions.ts      # Session pool — start/stop/status across multiple provider backends
├── models.ts        # Model catalog, API key resolution, LanguageModel creation
├── prompt.ts        # System prompt builder for agent/plan/ask modes
├── context.ts       # Workspace scanner — detects project type, structure, README
├── streaming.ts     # LLM streaming helpers (retry, cost, token estimation, pruning, errors)
├── constants.ts     # Shared constants (IGNORE_DIRS)
├── types.ts         # Core type definitions (AgentBackend, StartOptions, ToolApproval)
└── tools/           # One file per tool
    ├── index.ts     # Tool registry — wraps ToolDefinitions into AI SDK ToolSet
    ├── types.ts     # ToolContext, ToolResult, ToolDefinition types + truncateOutput
    ├── ask.ts       # ask_question — structured user input
    ├── bash.ts      # bash — shell command execution
    ├── delete.ts    # delete — file deletion
    ├── edit.ts      # edit — surgical string replacement in files
    ├── glob.ts      # glob — find files by pattern
    ├── grep.ts      # grep — regex search across files
    ├── ls.ts        # ls — directory listing
    ├── read.ts      # read — file reading with offset/limit
    ├── readlints.ts # readlints — lint/type error checking
    ├── todowrite.ts # todowrite — task list management
    └── write.ts     # write — file creation/overwrite
```

## Public API

```typescript
import {
  // Session management
  createSessionPool,
  type SessionPool,
  type SessionPoolOptions,

  // Agent runner
  createCustomAgentBackend,
  generateThreadTitle,
  type AgentBackendConfig,

  // Types
  type AgentBackend,
  type AgentBackendStartOptions,
  type ToolApprovalResult,
  type ModelOption,
  type ProviderCapabilities,

  // System prompt
  buildSystemPrompt,
  COMPACTION_PROMPT,

  // Project detection
  detectProjectContext,
  IGNORE_DIRS,

  // Tools
  createToolSet,
  type ToolCallMetadata,
  type ToolContext,
  type ToolResult,
  type ToolDefinition,
} from "@agentide/agent";
```

## How It Works

### Session Lifecycle

```
createSessionPool({ backends, writeAgentLog })
    │
    ├── pool.start({ prompt, workspacePath, provider, ... })
    │       → creates AbortController
    │       → resolves provider backend
    │       → calls backend.start() (non-blocking)
    │       → returns sessionId
    │
    ├── pool.stop(sessionId)
    │       → aborts controller
    │       → cleans up session
    │
    └── pool.getStatus()
            → returns running/idle/error per session
```

### Agent Execution (runner.ts)

```
runAgent(config, options)
    │
    ├── Build system prompt (prompt.ts + context.ts)
    ├── Create tool set (tools/index.ts)
    ├── Summarize existing messages (if resuming thread)
    │
    └── Stream loop:
        ├── streamText() → LLM call with tools
        ├── Stream text deltas → onMessage (partial)
        ├── Tool calls → execute → onMessage (tool result)
        ├── Final text → onMessage (complete)
        │
        ├── On tool-calls finish reason → continue loop
        ├── On context overflow → compactConversation → retry
        ├── On rate limit → parseRetryDelay → abortableSleep → retry
        └── On completion → onResult with cost/token stats
```

### Modes

| Mode | Tools | Max Steps | Use Case |
|---|---|---|---|
| `agent` | Full (11 tools) | 75 | Code changes, file operations |
| `plan` | Read-only (5 tools) | 20 | Architecture planning, analysis |
| `ask` | Read-only (5 tools) | 20 | Questions about code |

### Models

Defined in `models.ts`. Each model specifies:
- `value` / `label` — ID and display name
- `llmProvider` — which SDK to use (`anthropic` / `openai` / `minimax`)
- `apiModelId` — actual API model identifier
- `uiProvider` — which UI provider tab it belongs to
- Pricing per 1k tokens (input/output)

## Adding a New Tool

1. Create `src/tools/yourtool.ts`:

```typescript
import { z } from "zod";
import type { ToolDefinition, ToolResult } from "./types.js";

export const yourTool: ToolDefinition = {
  id: "yourtool",
  description: "What this tool does",
  parameters: z.object({
    param: z.string().describe("Parameter description"),
  }),
  execute: async (args, ctx) => {
    // implementation
    return { title: "Short title", output: "result text", metadata: {} };
  },
};
```

2. Register in `src/tools/index.ts`:

```typescript
import { yourTool } from "./yourtool.js";

// Add to createToolSet return object:
yourtool: wrapTool(yourTool, ctx, onToolCall),
```

3. Re-export types if needed from `src/index.ts`.

## Adding a New Model

Add an entry to the `MODELS` array in `src/models.ts`:

```typescript
{
  value: "model-id",
  label: "Display Name",
  llmProvider: "anthropic",      // or "openai" | "minimax"
  apiModelId: "api-model-id",
  uiProvider: "claude",          // or "codex" | "minimax"
  inputPricePer1k: 0.003,
  outputPricePer1k: 0.015,
}
```

## Scripts

| Command | Description |
|---|---|
| `bun run build` | Compile TypeScript with tsc |
| `bun run dev` | Watch mode compilation |
| `bun run clean` | Remove dist/ |

## Dependencies

| Package | Purpose |
|---|---|
| `ai` | Vercel AI SDK — streaming, tool calling, model abstraction |
| `@ai-sdk/anthropic` | Anthropic provider for AI SDK |
| `@ai-sdk/openai` | OpenAI provider for AI SDK |
| `vercel-minimax-ai-provider` | MiniMax provider for AI SDK |
| `@agentide/shared` | Shared types |
| `zod` | Schema validation for tool parameters |
| `ulid` | Sortable unique IDs |

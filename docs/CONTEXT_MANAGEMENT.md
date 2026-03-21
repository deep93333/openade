# Context Management Deep Dive

> **Honest status**: This doc describes the intended design. In reality, only compaction fully works. See `HONEST_REVIEW.md` for the candid assessment.

How AgentIDE manages conversation context across the agent lifecycle, compared against approaches used by Claude Code, Codex, and OpenCode.

---

## The Core Problem

LLMs are **stateless**. Every API call sends the full conversation from scratch. As conversations grow, this means:

1. **Token cost grows linearly** per message (and quadratically over a session)
2. **Context windows have hard limits** (200K for Claude, 400K-1M for GPT-5.x)
3. **Older context becomes less useful** — tool outputs from 50 messages ago rarely matter
4. **Follow-up messages replay everything** — the same prefix costs tokens every time

Every coding agent must solve this. Here's how each one does it.

---

## AgentIDE: 4-Layer Strategy

AgentIDE is the most layered approach. Each layer operates independently and handles a different scale of context pressure.

### Layer 1: Tool Output Pruning

**File**: `streaming.ts` → `pruneConversation()`

**Trigger**: Every iteration of the agent loop, before sending messages to the model.

**Mechanism**:
- Scans all `tool` role messages from newest to oldest
- Keeps the most recent 40K tokens of tool output intact
- Everything older gets content replaced with `"[Old tool result content cleared]"`
- The message structure is preserved (maintains valid message sequence)

**Why it works**: Tool results are the largest token consumers in coding agents. A single `read` of a large file can be 10K+ tokens. Most of that content is never re-referenced after the model has processed it once.

**Token savings**: Moderate. In a 100K-token conversation, this typically saves 30-50K tokens.

```
Constants:
  PRUNE_PROTECT_TOKENS = 40,000   (keep this many recent tool tokens)
  PRUNE_MIN_SAVINGS    = 20,000   (don't prune unless we'd save at least this much)
```

**Comparison**:
- Claude Code: Does NOT do this. Relies entirely on compaction.
- Codex: Not applicable — server manages context.
- OpenCode: Does NOT do this.

### Layer 2: Episode Summarization

> **STATUS: DEAD CODE. Marked for removal.**

**File**: `context-manager.ts` + `custom-agent-backend.ts` → `generateEpisode()`

**Intended design**: Take chunks of 20 messages, summarize them, inject summaries at the start of context.

**What actually happens**: `generateEpisode()` runs and makes an API call (~15K input tokens + 500 output tokens). The summary is stored in `contextManager.episodes`. But `buildContextWithEpisodes()` is **never called from the agent loop**. Episodes sit in memory unused. The conversation grows until compaction handles it.

**Cost of the bug**: Each episode wastes ~$0.05-0.15. A long session triggering 3-4 episodes wastes $0.15-0.60 in dead API calls.

**Why it's overkill even if fixed**: Claude Code doesn't have episodes and works fine with compaction alone. Episodes add complexity for marginal benefit. For very long sessions where granularity would matter, compaction already handles context pressure.

### Layer 3: Full Compaction

**File**: `custom-agent-backend.ts` → `compactConversation()`

**Trigger**:
- **Proactive**: When estimated tokens > 70% of context window
- **Reactive**: On context overflow error from the API

**Mechanism**:
1. Splits conversation into "older" and "recent" using `splitForCompaction()`
2. Recent = last 30K tokens of conversation (preserved verbatim)
3. Older = everything before that
4. Sends older messages to the model with `COMPACTION_PROMPT`
5. Gets back a structured summary:
   ```
   ## Goal
   ## Instructions
   ## Discoveries
   ## Accomplished
   ## Relevant Files
   ```
6. Replaces the full conversation with: `[summary] + [continue prompt] + [recent messages]`

**Why it works**: Last resort before context death. Trades conversation detail for survival. The structured prompt ensures the summary captures the most critical information (goal, instructions, file paths, what's done).

```
Constants:
  PROACTIVE_COMPACTION_RATIO    = 0.70      (compact at 70% of window)
  COMPACTION_KEEP_RECENT_TOKENS = 30,000    (always preserve this much recent context)
```

**Before compaction** (180K tokens, 200K window):
```
[system prompt]         ~2K tokens
[episodes summary]      ~1K tokens
[150K tokens old msgs]
[30K tokens recent]
```

**After compaction** (~35K tokens):
```
[system prompt]         ~2K tokens
[compaction summary]    ~2K tokens
[continue prompt]       ~50 tokens
[30K tokens recent]
```

**Comparison**:
- Claude Code: Similar approach. Uses Haiku (cheapest model) for compaction. Trigger threshold is configurable.
- Codex: Does NOT compact — `previous_response_id` lets the server manage this.
- OpenCode: Manual `/compact` command. User controls when to compact.

### Layer 4: Active Memory

**File**: `custom-agent-backend.ts` → `generateActiveMemory()`

**Trigger**: After a successful agent run completes (not on abort, not in ask/plan modes).

**Mechanism**:
1. Sends the full conversation to the model with `ACTIVE_MEMORY_PROMPT`
2. Gets back a structured snapshot (max 2K output tokens):
   ```
   ## Goal
   ## User Instructions
   ## Codebase Knowledge
   ## Completed
   ## Remaining
   ## Key Files
   ```
3. Stored on the `ChatThread` object
4. On the next message in the same thread, injected as the first context:
   ```
   [user] "Active session memory from previous runs: ..."
   [assistant] "Understood, continuing."
   [new user message]
   ```

**The idea is sound** — it's dramatically cheaper than replaying 100K+ tokens of conversation history.

**But it's fragile in practice**:
- Only generated after **successful, non-aborted, agent-mode** runs
- If the user stops the agent (common for long tasks) → no active memory
- If the agent errors → no active memory
- If mode is ask/plan/review → no active memory
- If the API call times out (30s) → no active memory

When active memory isn't available, follow-ups fall through to Path B (below) — a crude text dump with 800-char caps on tool outputs and 2000-char caps on assistant messages. Most of the conversation detail is lost.

**The real tradeoff**: This is **lossy compression** even when it works. Claude Code and OpenCode replay the full history (expensive but lossless). Codex uses server-side continuation (lossless and cheap). AgentIDE's active memory is the only follow-up strategy and it fails silently in the most common scenarios.

**Should be fixed**: Generate active memory even on abort (with short timeout, cheap model). And once conversation persistence is added, active memory becomes a nice optimization instead of the only lifeline.

---

## Context Seed: Follow-Up Messages

**File**: `custom-agent-backend.ts` → `buildContextSeed()`

When a user sends a follow-up in an existing thread, AgentIDE builds the initial context from one of two sources:

### Path A: Active Memory Available (preferred)

```
[user] "Active session memory from previous runs:\n\n{activeMemory}\n\nContinue from where we left off."
[assistant] "Understood, I have the session context. Continuing."
[new user message]
```

Cost: ~2K tokens for the memory, regardless of original conversation length.

### Path B: No Active Memory, Existing Messages

Falls back to a compressed replay of the thread's messages:

```
[user] "Previous conversation in this thread:\n\n
  [User]: original message
  [Assistant]: (capped at 2000 chars)
  [read]: (capped at 800 chars)
  [edit]: (capped at 800 chars)
  ...\n\nContinue from where we left off."
[assistant] "Understood, continuing."
[new user message]
```

This caps assistant messages at 2K chars and tool outputs at 800 chars, which is a rough compression but much cheaper than full replay.

### Comparison

| Framework | Follow-up Strategy | Typical Token Cost |
|-----------|-------------------|-------------------|
| AgentIDE | Active memory injection | ~2K tokens |
| Claude Code | Full history replay with prompt cache | Full history (but cached prefix is cheap) |
| Codex | `previous_response_id` (server continuation) | ~0 extra tokens |
| OpenCode | Full history from SQLite | Full history |

---

## Prompt Caching

**File**: `cache.ts` → `addCacheControl()`

AgentIDE implements Anthropic-style prompt caching:

1. Counts consecutive user/assistant messages from the start of conversation (the "stable prefix")
2. Adds `providerOptions: { anthropic: { cacheControl: { type: "ephemeral" } } }` to each
3. Only applied for Anthropic models

This tells Anthropic's API to cache the KV attention state for the stable prefix. On the next request, if the prefix hasn't changed, the cached computation is reused at 1/10th the cost.

**How `prepareStep` is used**:
```typescript
prepareStep: ({ messages, model }) => ({
  messages: addCacheControl({ messages, model }),
})
```

The `prepareStep` callback runs before each `streamText` step (including multi-step tool-call loops), ensuring cache control headers are always applied.

**Comparison**:
- Claude Code: Same approach (Anthropic cache control), but also benefits from server-side caching automatically.
- Codex: OpenAI's `previous_response_id` is effectively server-side caching on steroids — zero-cost continuation.
- OpenCode: Relies on whatever the provider supports. No explicit cache control injection.

---

## Long Output Offloading — DEAD CODE

> **STATUS: Built but never enabled. `TOOLS_TO_FILE_ON_LONG_OUTPUT` is an empty Set. Also `initContextManager` doesn't create the target directory, so enabling it without adding `fs.mkdir` will crash.**

**File**: `context-manager.ts` → `writeToolOutputToFile()`

When a tool produces >4000 chars of output, the context manager *could* write it to `.agentide/context/{tool}_{ulid}.txt` and return a compressed reference:

```
[Output written to file: .agentide/context/bash_01JK7X.txt]
[450 lines, ~3200 tokens, 12800 chars]

Preview (first 500 chars):
{first 500 characters of output}...

Use 'read' tool with path ".agentide/context/bash_01JK7X.txt" to see full output, or 'grep' to search within it.
```

The model can then choose to read the file if it needs the full content, or proceed with just the preview.

**Current state**: Dead code. Enable by adding `"bash"`, `"grep"` to the Set and adding `fs.mkdir(contextDir, { recursive: true })` to `initContextManager`. Or delete the 300 lines.

**Comparison**:
- Claude Code: Does NOT offload. All tool outputs stay in context.
- Codex: Sandbox filesystem handles this implicitly.
- OpenCode: Does NOT offload.

---

## Token Estimation

**File**: `streaming.ts` → `estimateTokens()`, `estimateConversationTokens()`

AgentIDE uses a simple 4-chars-per-token estimate:

```typescript
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
```

This is used for:
- Deciding when to create episodes (15K token threshold)
- Deciding when to compact (70% of context window)
- Deciding how much to keep in recent context (30K tokens)
- Tool output pruning threshold (40K tokens)

**Accuracy**: This is a rough heuristic. Real tokenizers produce different counts depending on the model. For English text, the 4:1 ratio is typically within 20% of actual token count. For code (which has more special characters), it can be off by 30-40%.

**Impact**: Since all thresholds use the same estimator, the relative proportions are consistent even if absolute numbers are off. The main risk is premature compaction (if the estimate is too high) or late compaction (if too low, causing context overflow which triggers reactive compaction anyway).

**Comparison**:
- Claude Code: Uses `@anthropic-ai/tokenizer` for exact Anthropic token counts.
- Codex: Server-side token counting.
- OpenCode: Uses `tiktoken` for exact OpenAI token counts.

---

## Timeline: What Happens During a Long Session

```
Message 1  → System prompt + user message                              (~3K tokens)
           → 5 tool calls (read, grep, edit, read, bash)               (+15K tokens)
           → Total: ~18K tokens

Message 2  → Full history replay                                       (~18K + 3K new)
           → 8 tool calls                                              (+20K tokens)
           → Total: ~41K tokens
           → Pruning clears oldest 5K of tool output                   (-5K)

Message 3  → 36K + 3K new
           → 10 tool calls                                             (+25K tokens)
           → Episode triggered (msgs 1-20 → ~200 token summary)
           → Pruning clears oldest 15K of tool output                  (-15K)
           → Total: ~49K tokens

...

Message 8  → Approaching 140K tokens (70% of 200K window)
           → PROACTIVE COMPACTION fires
           → Older messages (110K) → summary (~2K)
           → Keep recent 30K
           → Total: ~32K tokens (back to healthy)

...

Session end → Active memory generated (~2K summary)

Follow-up  → Active memory injected (~2K) + new message
           → Starting fresh at ~5K tokens instead of 150K+
```

---

## Configuration Summary

| Constant | Value | Where Used |
|----------|-------|------------|
| `PRUNE_PROTECT_TOKENS` | 40,000 | Keep this many recent tool output tokens |
| `PRUNE_MIN_SAVINGS` | 20,000 | Don't prune unless saving at least this |
| `EPISODE_CHUNK_SIZE` | 20 | Messages per episode |
| `EPISODE_TOKEN_THRESHOLD` | 15,000 | Min tokens before episode creation |
| `PROACTIVE_COMPACTION_RATIO` | 0.70 | Compact at 70% of context window |
| `COMPACTION_KEEP_RECENT_TOKENS` | 30,000 | Preserve this much recent context on compaction |
| `LONG_OUTPUT_THRESHOLD` | 4,000 | Offload tool outputs larger than this to file |
| `TOOL_OUTPUT_LIMIT` | 800 | Cap tool outputs in context seed (follow-ups) |
| `ASSISTANT_MSG_LIMIT` | 2,000 | Cap assistant messages in context seed |
| `MAX_TOOL_STEPS` | 75 | Max tool call iterations per agent run |
| `RETRY_MAX_ATTEMPTS` | 10 | Max retry attempts on rate limit |
| `RETRY_MAX_DELAY` | 30,000 | Max delay between retries (ms) |

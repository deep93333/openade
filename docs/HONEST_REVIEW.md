# AgentIDE Agent — Honest Review

A candid assessment of every subsystem. What works, what's broken, what's overkill, what to cut.

---

## Verdict by Subsystem

| Subsystem | Status | Verdict |
|-----------|--------|---------|
| Agent loop (streamText → tools → loop) | **Works** | Solid. Keep. |
| Multi-provider via Vercel AI SDK | **Works** | Genuine advantage. Keep. |
| System prompts (mode-specific) | **Works** | Well-crafted. Keep. |
| Tool set (12 tools + MCP) | **Works** | Good coverage. Keep. |
| Retry + error recovery | **Works** | Thorough. Keep. |
| Abort signal chaining | **Works** | Correct. Keep. |
| Dynamic pricing (models.dev) | **Works** | Clever. Keep. |
| Cost tracking (cache-aware) | **Works** | Accurate. Keep. |
| Prompt caching (Anthropic) | **Works** | Correct implementation. Keep. |
| Sub-agents (delegate tool) | **Works** | Useful but uses wrong model. Fix. |
| Compaction | **Works but wasteful** | Uses expensive model. Fix. |
| Active memory | **Partially works** | Only after successful runs. Fix or simplify. |
| Tool output pruning | **Probably broken** | Only handles array content shape. Verify/fix. |
| Episode summarization | **Dead code** | Generated but never injected. Remove. |
| Long output offloading | **Dead code** | Built but never enabled. Enable or remove. |
| Tool approval (requestUserInput) | **Dead code** | Wired but no tool calls it. Fix or remove. |
| Conversation persistence | **Missing** | Nothing survives a crash. Add. |
| Sandboxing | **Missing** | Bash has full system access. Add. |

---

## What's Good — Keep As-Is

### 1. Core Agent Loop

The `streamText()` → stream deltas → execute tools → append messages → loop pattern is correct and well-implemented. The Vercel AI SDK handles the heavy lifting (streaming, tool call parsing, usage tracking), and the wrapping code is clean.

The two-path structure (ask/plan vs agent) makes sense conceptually even though the implementation is duplicated.

### 2. Multi-Provider Support

13 models across 4 providers (Anthropic, OpenAI, MiniMax, Moonshot) with a single `createLanguageModel()` factory. This is a real advantage over Claude Code (Anthropic-only) and Codex (OpenAI-only). The Vercel AI SDK makes this almost free to maintain.

### 3. System Prompts

Four mode-specific prompts (agent, ask, plan, review) with:
- Auto-detected project context (directory tree, package manifest, README excerpt)
- Environment info (OS, shell, cwd, date)
- Explicit tool efficiency rules (don't re-read files, batch searches, use grep not bash)
- Mode-appropriate tool restrictions

This is genuinely better than most open-source agents. The tool efficiency rules alone probably save 20-30% of wasted tool calls.

### 4. Tool Set

12 tools with proper Zod schemas, consistent error handling, and output truncation. The `delegate` tool for parallel read-only sub-agents is a good feature. `readlints`, `ask_question`, and `todowrite` are thoughtful additions that most agents lack.

### 5. Error Recovery

- Retry with exponential backoff (respects `retry-after` headers)
- Context overflow detection via regex patterns on error messages
- Reactive compaction on overflow
- Abortable sleep for clean cancellation during retry waits
- Structured error message extraction from multiple API error shapes

### 6. Dynamic Pricing

Fetching pricing from `models.dev/api.json` with 24h cache TTL means cost tracking stays accurate when providers change rates. No other open-source agent does this.

### 7. Prompt Caching

`cache.ts` correctly identifies the stable conversation prefix and applies Anthropic's `ephemeral` cache control. This gives ~90% cost reduction on cached prefixes for follow-up API calls within the same agent run.

---

## What Needs Fixing

### 8. Compaction Uses the User's Expensive Model

**Problem**: `compactConversation()`, `generateEpisode()`, and `generateActiveMemory()` all call `createLanguageModel(modelDef, config)` where `modelDef` is whatever the user selected (could be Opus at $5/$25 per 1M tokens).

**Impact**: A compaction call on a 140K-token conversation with Opus costs ~$0.75. With Haiku it would be ~$0.14. Compaction can happen multiple times per session.

**Fix**: Use the cheapest available model for compaction, episodes, and active memory. Add a `getCheapModel()` function that returns the lowest-cost model for the same provider, or always use Haiku/GPT-5 Mini for summarization tasks.

```typescript
function getCheapSummaryModel(primaryModel: ModelDef, config: AgentBackendConfig): LanguageModel {
  const cheap = MODELS.find(m => 
    m.llmProvider === primaryModel.llmProvider && 
    m.pricing.inputPer1M === Math.min(...MODELS.filter(x => x.llmProvider === primaryModel.llmProvider).map(x => x.pricing.inputPer1M))
  );
  return createLanguageModel(cheap ?? primaryModel, config);
}
```

### 9. Sub-Agents Use the Expensive Model

**Problem**: `runSubAgent()` receives `languageModel` from the parent, which is the user's selected model. Sub-agents only read/grep/glob — they don't need Opus.

**Fix**: Same as above. Pass the cheap summary model to sub-agents.

### 10. Tool Output Pruning Might Be a No-Op

**Problem**: `pruneConversation()` checks `msg.role === "tool"` then `Array.isArray(msg.content)` then looks for objects with an `"output"` field. But tool results from the Vercel AI SDK may be stored differently in `response.messages`.

**Action**: Add a log statement or console.log to check the actual shape of tool result messages from `response.messages`. If they're plain strings or a different structure, the pruning does nothing and the conversation grows unbounded until compaction.

### 11. Active Memory Only Works After Successful Runs

**Problem**: Active memory is generated only when:
- `mode === "agent"` (not ask, plan, or review)
- `conversationHistory.length > 0`
- `!linkedAbort.signal.aborted` (user didn't stop the agent)

If the user stops the agent mid-task (the most common case for long tasks), they get no active memory. The follow-up then falls through to `buildContextSeed()` path B — a crude text dump with 800-char tool output caps.

**Fix options**:
- Generate active memory even on abort (use a separate non-linked abort signal with a short timeout)
- Or persist the full conversation to disk (preferred — makes active memory a nice-to-have instead of the only lifeline)

### 12. `requestUserInput` Is Never Called

**Problem**: `ToolContext.requestUserInput` is set up in the tool context but no tool implementation ever calls `ctx.requestUserInput()`. Tools execute immediately when invoked by the model.

The `canUseTool` callback from the UI is assigned to `requestUserInput` but the wiring is incomplete — `wrapTool` calls `def.execute(args, ctx)` directly without checking approval first.

**Fix**: Add approval check in `wrapTool` before calling `def.execute`:

```typescript
function wrapTool(def, ctx, onToolCall) {
  return tool({
    // ...
    execute: async (args) => {
      // Check approval BEFORE executing
      if (ctx.requestUserInput && needsApproval(def.id)) {
        const approval = await ctx.requestUserInput(def.id, args);
        if (approval.denied) {
          return `Tool denied: ${approval.message ?? "User denied this action"}`;
        }
        if (approval.updatedInput) args = approval.updatedInput;
      }
      // ... proceed with def.execute
    }
  });
}
```

### 13. Module-Level `activeSessions` Map

**Problem**: `const activeSessions = new Map<string, AbortController>()` is module-level global state. Multiple instances of `createCustomAgentBackend` share it. Causes bugs in tests and if the module is loaded twice.

**Fix**: Move it inside `createCustomAgentBackend` as instance state.

### 14. `runAgent` Is 550 Lines

**Problem**: One function handles model resolution, system prompt, abort wiring, MCP creation, context seeding, the ask/plan loop, the agent loop, episode management, compaction, retry, and active memory.

**Fix**: Extract at minimum:
- `runAskPlanMode()` — the read-only/planning agent loop
- `runAgentMode()` — the full agent loop
- Keep shared setup/teardown in `runAgent()`

This halves the function size and eliminates the duplicated streaming/retry logic.

### 15. Token Estimation Is Inaccurate

**Problem**: `Math.ceil(text.length / 4)` can be 30-40% off for code. All thresholds (episode: 15K, pruning: 40K, compaction: 70% of window) use this estimate.

**Impact**: The 70% compaction threshold with 30% estimation error means you sometimes compact at actual 50% (wasting an API call + losing context) or hit the wall at actual 100% (emergency reactive compaction).

**Fix**: Use a real tokenizer for the primary providers:
- `@anthropic-ai/tokenizer` for Anthropic
- `js-tiktoken` for OpenAI
- Fall back to 4:1 for others

Or, more pragmatically: lower the proactive compaction threshold to 55-60% to give yourself more headroom against estimation error.

---

## What to Remove — Overkill / Dead Code

### 16. Episode Summarization — REMOVE

**The entire episode system is dead code.**

`generateEpisode()` is called from the agent loop. It makes an API call, generates a summary, stores it in `contextManager.episodes`. But `buildContextWithEpisodes()` is never called from the agent loop. The episodes are never injected back into the conversation. They just sit in memory doing nothing.

Meanwhile, each episode costs an API call (~15K input tokens + 500 output tokens). For a long session that triggers 3-4 episodes, that's $0.15-0.60 of pure waste.

**What to remove**:
- `generateEpisode()` in `custom-agent-backend.ts`
- `extractToolsFromMessages()` (only used by episodes)
- `estimateMessagesTokens()` (only used by episodes)
- `buildContextWithEpisodes()` in both `custom-agent-backend.ts` and `context-manager.ts`
- Episode-related code in `context-manager.ts`: `shouldCreateEpisode()`, `getMessagesForEpisode()`, `addEpisode()`
- `EPISODE_PROMPT` in `system-prompt.ts`
- `EPISODE_CHUNK_SIZE`, `EPISODE_TOKEN_THRESHOLD`, `RECENT_MESSAGES_TO_KEEP` constants
- `MemoryEpisode` type from shared (if not used elsewhere in UI)
- The episode creation block in the agent loop (lines 664-693)

**If you want episodes later**: First make them actually work by calling `buildContextWithEpisodes()` to replace old messages with episode summaries. But honestly, compaction alone (what Claude Code does) is simpler, cheaper, and sufficient.

### 17. Long Output Offloading Infrastructure — EITHER ENABLE OR REMOVE

`context-manager.ts` has 300 lines of code for:
- `writeToolOutputToFile()` — writes large outputs to `.agentide/context/`
- `saveChatHistoryToFile()` — writes full chat history to file
- `cleanupOldContextFiles()` — cleanup old files
- `getContextDebugInfo()` — debug stats
- `ContextFile` and `ContextManagerState` types

None of this runs because `TOOLS_TO_FILE_ON_LONG_OUTPUT` in `registry.ts` is an empty Set.

**Decision**: Either enable it by adding `"bash"`, `"grep"`, `"read"` to the Set, or delete the 300 lines. Carrying dead infrastructure adds confusion.

**Note**: `initContextManager()` doesn't even create the `.agentide/context/` directory, so enabling it without adding `fs.mkdir(contextDir, { recursive: true })` will crash on the first write.

### 18. `saveChatHistoryToFile` — REMOVE

This function formats the entire chat history as markdown and writes it to a file. It's never called from anywhere. The context manager `buildContextWithEpisodes()` references a `chatHistoryFile` parameter, but since that function is also never called, this is dead code pointing to dead code.

### 19. `cleanupOldContextFiles` — REMOVE (unless you enable offloading)

Never called. Only useful if the offloading system is enabled.

### 20. `RECENT_MESSAGES_TO_KEEP` Constant — REMOVE

Defined as 30 but never referenced in any logic. The compaction uses `COMPACTION_KEEP_RECENT_TOKENS` (30,000 tokens) instead, which is a different concept.

### 21. `buildContextWithEpisodes` Duplication — REMOVE ONE

This function exists in both `context-manager.ts` (line 210) and `custom-agent-backend.ts` (line 232) with slightly different signatures. Neither is called. If you keep one, delete the other.

---

## What's Missing — Must Add

### 22. Conversation Persistence

**Priority**: Critical.

Zero persistence today. The conversation lives in a JS array inside `runAgent()` that dies when the function returns, plus the Zustand store in the Electron renderer that dies on app restart.

**Minimum viable**: Append each message as JSONL to `.agentide/threads/{threadId}.jsonl` as it arrives. On thread resume, read and replay.

### 23. Bash Sandboxing

**Priority**: Critical.

The `bash` tool runs arbitrary commands with `{ env: { ...process.env } }` — full environment including secrets, tokens, SSH keys. No directory restriction, no network isolation.

**Minimum viable**: Block obviously dangerous patterns (`rm -rf /`, `sudo`, pipe-to-shell, curl+eval). Validate that file paths in commands resolve within `workspacePath`.

### 24. Tool Approval Flow

**Priority**: High.

As noted, the `requestUserInput` → `canUseTool` wiring exists but tools never check it. Either wire it into `wrapTool` (preferred) or remove the dead plumbing.

---

## Honest Comparison to Competitors

| Feature | AgentIDE (actual) | Claude Code | Codex | OpenCode |
|---------|-------------------|-------------|-------|----------|
| Agent loop | Works | Works | Works | Works |
| Context management | Compaction only (episodes are dead) | Compaction (Haiku, cheap) | Server-side (free) | Manual /compact |
| Follow-up strategy | Active memory (sometimes) or crude dump | Full history replay (cached) | Server continuation | Full SQLite replay |
| Persistence | None | JSONL files | Server-side | SQLite |
| Sandboxing | None | Permission system | Docker/seatbelt | None |
| Tool approval | Dead code | Working | Autonomy modes | None |
| Multi-provider | 4 providers, 13 models | Anthropic only | OpenAI only | Any OpenAI-compatible |
| Cost tracking | Accurate + dynamic pricing | Accurate | Limited | None |
| Sub-agents | Yes (expensive model) | Yes (can use different model) | No | No |

**Honest summary**: AgentIDE's real advantages are multi-provider support and dynamic pricing. Everything else is at parity or behind. The "sophisticated 4-layer context management" is actually 1 working layer (compaction) with dead code for the other 3.

---

## Recommended Action Plan

### Phase 1: Cut Dead Weight (1-2 hours)

1. Delete all episode code (generation, prompts, context manager functions, constants)
2. Delete `buildContextWithEpisodes` from both files
3. Delete `saveChatHistoryToFile`, `cleanupOldContextFiles` (unless enabling offloading)
4. Remove `RECENT_MESSAGES_TO_KEEP`
5. Move `activeSessions` inside `createCustomAgentBackend`

### Phase 2: Fix What's Broken (2-4 hours)

6. Verify `pruneConversation` against actual AI SDK message shapes — add a debug log, run one session, check
7. Wire tool approval into `wrapTool` (check before execute)
8. Use cheap model for compaction and active memory
9. Use cheap model for sub-agents
10. Generate active memory even on abort (with short timeout)

### Phase 3: Add What's Missing (1-2 days)

11. JSONL conversation persistence
12. Bash command blocklist
13. Extract `runAskPlanMode` / `runAgentMode` from the 550-line `runAgent`

### Phase 4: Decide on Offloading (30 minutes)

14. Either enable `TOOLS_TO_FILE_ON_LONG_OUTPUT` for bash/grep/read (add mkdir, add tools to Set) or delete the 300 lines of context-manager infrastructure

---

## Lines of Code Impact

| Action | Lines Removed | Lines Added | Net |
|--------|---------------|-------------|-----|
| Remove episode code | ~120 | 0 | -120 |
| Remove dead context-manager code | ~80 | 0 | -80 |
| Remove duplicate buildContextWithEpisodes | ~35 | 0 | -35 |
| Wire tool approval | 0 | ~15 | +15 |
| Cheap model for compaction/memory/sub-agents | ~5 | ~25 | +20 |
| JSONL persistence | 0 | ~80 | +80 |
| Bash blocklist | 0 | ~30 | +30 |
| Extract runAskPlanMode | ~250 (move) | ~260 (restructure) | +10 |
| **Total** | ~490 removed | ~410 added | **-80 net** |

The codebase gets smaller AND gains real features.

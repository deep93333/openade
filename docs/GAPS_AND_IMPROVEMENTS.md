# Gaps & Improvements (Revised)

Honest, prioritized list. Dead code is marked for removal, not improvement.

---

## REMOVE — Dead Code / Overkill

### 1. Episode Summarization System

**Status**: Dead code. Episodes are generated (costing API calls) but never injected into context.

**What to delete**:
- `custom-agent-backend.ts`: `generateEpisode()`, `extractToolsFromMessages()`, `estimateMessagesTokens()`, `buildContextWithEpisodes()`, episode creation block in agent loop (lines 664-693), `EPISODE_CHUNK_SIZE`, `EPISODE_TOKEN_THRESHOLD`, `RECENT_MESSAGES_TO_KEEP`
- `context-manager.ts`: `shouldCreateEpisode()`, `getMessagesForEpisode()`, `addEpisode()`, `buildContextWithEpisodes()`
- `system-prompt.ts`: `EPISODE_PROMPT`
- `@agentide/shared`: `MemoryEpisode`, `EpisodeDebugInfo` types (if UI doesn't depend on them)

**Why remove instead of fix**: Compaction alone is what Claude Code uses and it's sufficient. Episodes add cost and complexity for marginal benefit. If you want them later, you can re-add them — but first make them actually work.

### 2. Unused Context Manager Functions

**Status**: Never called from anywhere.

**What to delete**:
- `context-manager.ts`: `saveChatHistoryToFile()`, `cleanupOldContextFiles()`, `formatChatHistory()`, `formatMessageContent()` (the one inside context-manager)
- Duplicate `buildContextWithEpisodes()` (exists in both files)

### 3. `RECENT_MESSAGES_TO_KEEP` Constant

**Status**: Defined (30) but never used in any logic. Compaction uses `COMPACTION_KEEP_RECENT_TOKENS` instead.

---

## FIX — Broken or Wasteful

### 4. Compaction Uses Expensive Model — FIX NOW

**Problem**: `compactConversation()`, `generateActiveMemory()` all use the user's selected model.

**Cost**: Compacting 140K tokens with Opus = ~$0.75. With Haiku = ~$0.14. 5x waste.

**Fix**: Add `getCheapSummaryModel()` that picks the cheapest model for the same LLM provider. Use it for compaction, active memory, and sub-agents.

**Files**: `custom-agent-backend.ts`, `models.ts`

### 5. Sub-Agents Use Expensive Model — FIX NOW

**Problem**: `delegate` passes the parent's `languageModel` to sub-agents. Read-only exploration doesn't need Opus.

**Fix**: Same cheap model function from #4.

**Files**: `custom-agent-backend.ts` (where `subAgent` capability is created)

### 6. Verify Pruning Actually Works — VERIFY NOW

**Problem**: `pruneConversation()` checks `Array.isArray(msg.content)` and looks for objects with `"output"` in them. If the Vercel AI SDK stores tool results differently, pruning is a no-op.

**Action**: Add a temporary `console.log(JSON.stringify(msg.content).slice(0, 200))` inside `pruneConversation` for `tool` role messages. Run one session. Check the shape. Fix the pruning to match the actual format.

**Files**: `streaming.ts`

### 7. Wire Tool Approval into `wrapTool` — FIX

**Problem**: `requestUserInput` / `canUseTool` is set on the context but no tool calls it. Tools execute immediately.

**Fix**: Check approval in `wrapTool` before calling `def.execute()`:

```typescript
// In wrapTool, before def.execute:
if (ctx.requestUserInput && WRITE_TOOLS.has(def.id)) {
  const approval = await ctx.requestUserInput(def.id, args);
  if (approval.denied) return `Denied: ${approval.message ?? "User denied"}`;
  if (approval.updatedInput) args = approval.updatedInput;
}
```

**Files**: `tools/registry.ts`

### 8. Active Memory — Generate Even on Abort

**Problem**: Active memory only generated after successful, non-aborted agent runs. Aborted sessions (the most common case for long tasks) get no memory.

**Fix**: After the agent loop finishes (even if aborted), if `conversationHistory.length > 5`, generate active memory with a short timeout (15s) using the cheap model.

**Files**: `custom-agent-backend.ts` (around line 870)

### 9. Move `activeSessions` Into Instance

**Problem**: Module-level `Map<string, AbortController>` is shared across all backend instances.

**Fix**: Move inside `createCustomAgentBackend()`.

**Files**: `custom-agent-backend.ts`

### 10. `initContextManager` Doesn't Create Directory

**Problem**: If offloading is ever enabled, `writeToolOutputToFile` will crash because `.agentide/context/` doesn't exist.

**Fix**: Add `await fs.mkdir(contextDir, { recursive: true })` in `initContextManager`.

**Files**: `context-manager.ts`

---

## ADD — Missing Critical Features

### 11. Conversation Persistence — CRITICAL

**Problem**: Zero persistence. Crash = total data loss.

**What to build**: Append-only JSONL per thread.

```
.agentide/threads/{threadId}.jsonl
```

Each `onMessage` call appends one line. On resume, stream-parse the file. Active memory becomes a nice optimization instead of the only lifeline.

**Files**: New `persistence.ts`, changes to `custom-agent-backend.ts` and `agent-manager.ts`

### 12. Bash Sandboxing — CRITICAL

**Problem**: `spawn(args.command, { env: { ...process.env } })` — full system access including all env vars (API keys, tokens).

**Phase 1 (quick)**:
- Block dangerous patterns: `rm -rf /`, `sudo`, `curl|bash`, `eval`, `exec`
- Scrub sensitive env vars (API keys, tokens) from the spawned process env
- Validate file paths resolve within `workspacePath`

**Phase 2 (later)**:
- Docker container or macOS sandbox-exec

**Files**: `tools/bash.ts`

### 13. Extract `runAgent` Into Smaller Functions — HIGH

**Problem**: 550-line function with duplicated ask/plan and agent loops.

**What to extract**:
- `runReadOnlyMode(config, options, ...)` — ask/plan/review loop
- `runAgentMode(config, options, ...)` — full agent loop  
- Keep `runAgent()` as orchestrator: setup → dispatch to mode → teardown

**Files**: `custom-agent-backend.ts` (or split into `run-readonly.ts`, `run-agent.ts`)

---

## DECIDE — Enable or Delete

### 14. Long Output Offloading

The infrastructure exists (300 lines in `context-manager.ts`) but is disabled (`TOOLS_TO_FILE_ON_LONG_OUTPUT` is empty).

**Option A — Enable it**:
1. Add `"bash"`, `"grep"` to `TOOLS_TO_FILE_ON_LONG_OUTPUT`
2. Add `await fs.mkdir(contextDir, { recursive: true })` in `initContextManager`
3. Done. ~3 lines changed.

**Option B — Delete it**:
1. Remove `writeToolOutputToFile`, `ContextFile` type, file-tracking from `ContextManagerState`
2. Simplify `wrapTool` to remove file offloading branch
3. ~100 lines removed.

**Recommendation**: Option A. It's built, it works, it just needs enabling. The `bash` tool can produce 20K+ tokens from test output. Offloading that to a file and giving the model a preview saves significant context.

---

## Implementation Order

```
Day 1 (2-3 hours): Cut + Quick Fixes
├── Remove episode code (~120 lines deleted)
├── Remove dead context-manager functions (~80 lines deleted)
├── Move activeSessions into instance
├── Use cheap model for compaction/memory/sub-agents
├── Enable long output offloading (3 lines)
└── Add mkdir to initContextManager

Day 2 (3-4 hours): Fix Broken Features
├── Verify pruning shape (add debug log, run session, fix)
├── Wire tool approval into wrapTool
├── Generate active memory on abort
└── Add bash blocklist (dangerous patterns + env scrubbing)

Day 3 (4-6 hours): Add Missing Features
├── JSONL conversation persistence
└── Extract runAgent into runReadOnlyMode + runAgentMode

Day 4 (optional): Lower compaction threshold to 55%
```

---

## Before vs After

| Metric | Before | After |
|--------|--------|-------|
| Lines in custom-agent-backend.ts | 1040 | ~750 |
| Lines in context-manager.ts | 303 | ~100 |
| Dead code lines | ~350 | 0 |
| Working context layers | 1 (compaction) | 2 (pruning verified + compaction) |
| Compaction cost per call | $0.75 (Opus) | $0.14 (Haiku) |
| Conversation persistence | None | JSONL |
| Tool approval | Dead | Working |
| Bash safety | None | Blocklist + env scrub |
| Features that actually work | 8/18 | 14/14 |

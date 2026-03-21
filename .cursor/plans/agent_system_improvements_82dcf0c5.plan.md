---
name: Agent System Improvements
overview: "A phased plan to clean up dead code, fix broken/wasteful features, and add critical missing capabilities to the @agentide/agent package. Net result: ~80 fewer lines, 5x cheaper compaction, working tool approval, conversation persistence, and bash safety."
todos:
  - id: phase1a-remove-episodes
    content: Remove all episode dead code from custom-agent-backend.ts, context-manager.ts, system-prompt.ts, and index.ts
    status: completed
  - id: phase1b-active-sessions
    content: Move activeSessions map inside createCustomAgentBackend() as instance state
    status: completed
  - id: phase1c-enable-offloading
    content: "Enable output offloading: add bash/grep to TOOLS_TO_FILE_ON_LONG_OUTPUT, add fs.mkdir in initContextManager"
    status: completed
  - id: phase2a-cheap-model
    content: Add getCheapModel() to models.ts, use it in compaction, active memory, and sub-agents
    status: completed
  - id: phase2d-tool-approval
    content: Wire tool approval check into wrapTool for write tools (bash, write, edit, delete)
    status: completed
  - id: phase2e-memory-on-abort
    content: Generate active memory even on abort with cheap model and 15s timeout
    status: completed
  - id: phase2f-fix-pruning
    content: Fix pruneConversation to handle string tool content, not just array content
    status: completed
  - id: phase3a-persistence
    content: Create persistence.ts with JSONL append/load, integrate into runAgent
    status: completed
  - id: phase3b-bash-blocklist
    content: Add command blocklist and env var scrubbing to bash.ts
    status: completed
  - id: phase3c-extract-runagent
    content: Split runAgent into runReadOnlyMode + runAgentMode + orchestrator
    status: completed
isProject: false
---

# Agent System Improvement Plan

Based on the thorough self-assessment in the four docs, here is the concrete implementation plan across 4 phases.

## Architecture Overview (Before/After)

```mermaid
flowchart TB
  subgraph before [Current State]
    direction TB
    RunAgent["runAgent() - 550 lines"]
    Episodes["Episode System - DEAD CODE"]
    Offload["Output Offloading - DISABLED"]
    Approval["Tool Approval - DEAD WIRING"]
    Persistence["Persistence - NONE"]
    Sandbox["Bash Safety - NONE"]
    CheapModel["Cheap Model - NONE"]
  end

  subgraph after [Target State]
    direction TB
    RunAgentNew["runAgent() orchestrator ~100 lines"]
    ReadOnlyMode["runReadOnlyMode() ~200 lines"]
    AgentMode["runAgentMode() ~250 lines"]
    OffloadEnabled["Output Offloading - ENABLED"]
    ApprovalWorking["Tool Approval - WORKING"]
    PersistenceJSONL["Persistence - JSONL"]
    SandboxBlocklist["Bash Safety - BLOCKLIST"]
    CheapModelFn["getCheapModel() - 5x savings"]
  end
```



---

## Phase 1: Cut Dead Weight (~120 lines removed)

### 1a. Remove Episode System

All episode code is dead -- episodes are generated (costing API calls) but never injected into context.

**Files to edit:**

- [custom-agent-backend.ts](packages/agent/src/custom-agent-backend.ts):
  - Delete `EPISODE_CHUNK_SIZE`, `EPISODE_TOKEN_THRESHOLD`, `RECENT_MESSAGES_TO_KEEP` constants (lines 64-66)
  - Delete `extractToolsFromMessages()` (lines 160-172)
  - Delete `estimateMessagesTokens()` (lines 174-183)
  - Delete `generateEpisode()` (lines 185-230)
  - Delete `buildContextWithEpisodes()` (lines 232-267)
  - Delete the episode creation block in the agent loop (lines 664-693)
  - Remove `EPISODE_PROMPT` from imports (line 10)
  - Remove `MemoryEpisode` from shared imports (line 31)
  - Remove `shouldCreateEpisode`, `getMessagesForEpisode`, `addEpisode` from context-manager imports (lines 35-37)
- [context-manager.ts](packages/agent/src/context-manager.ts):
  - Delete `shouldCreateEpisode()` (lines 163-178)
  - Delete `getMessagesForEpisode()` (lines 180-200)
  - Delete `addEpisode()` (lines 202-208)
  - Delete `buildContextWithEpisodes()` (lines 210-251)
  - Delete `saveChatHistoryToFile()` (lines 83-106)
  - Delete `formatMessageContent()` (lines 108-121)
  - Delete `formatChatHistory()` (lines 123-147)
  - Delete `cleanupOldContextFiles()` (lines 253-273)
  - Remove `episodes` and `lastEpisodeEndIndex` from `ContextManagerState` (lines 23-24)
  - Remove duplicate episode constants (lines 8-9)
  - Remove `MemoryEpisode` import (line 5) and `ulid` import (line 3)
- [system-prompt.ts](packages/agent/src/system-prompt.ts):
  - Delete `EPISODE_PROMPT` export (lines 328-336)
- [index.ts](packages/agent/src/index.ts):
  - Remove all episode-related re-exports: `EPISODE_PROMPT`, `saveChatHistoryToFile`, `shouldCreateEpisode`, `getMessagesForEpisode`, `addEpisode`, `buildContextWithEpisodes`, `cleanupOldContextFiles`

### 1b. Move `activeSessions` Into Instance

Currently a module-level global at line 299 of `custom-agent-backend.ts`. Move it inside `createCustomAgentBackend()` so each backend instance has its own session map.

### 1c. Enable Long Output Offloading (3 lines)

- [registry.ts](packages/agent/src/tools/registry.ts) line 29: change `new Set<string>()` to `new Set<string>(["bash", "grep"])`
- [context-manager.ts](packages/agent/src/context-manager.ts) `initContextManager()`: add `await fs.mkdir(contextDir, { recursive: true })` before the return

---

## Phase 2: Fix Broken/Wasteful Features

### 2a. Add `getCheapModel()` to models.ts

Add a function that finds the cheapest model for the same LLM provider:

```typescript
export function getCheapModel(primaryModel: ModelDef): ModelDef {
  const sameProvider = MODELS.filter(m => m.llmProvider === primaryModel.llmProvider);
  return sameProvider.reduce((cheapest, m) =>
    m.pricing.inputPer1M < cheapest.pricing.inputPer1M ? m : cheapest
  , primaryModel);
}
```

### 2b. Use Cheap Model for Compaction + Active Memory

In [custom-agent-backend.ts](packages/agent/src/custom-agent-backend.ts):

- `compactConversation()` (line 939): replace `createLanguageModel(modelDef, config)` with `createLanguageModel(getCheapModel(modelDef), config)`
- `generateActiveMemory()` (line 981): same change

### 2c. Use Cheap Model for Sub-Agents

In [custom-agent-backend.ts](packages/agent/src/custom-agent-backend.ts) where `subAgent` capability is created (lines 633-636):

```typescript
subAgent: {
  languageModel: createLanguageModel(getCheapModel(modelDef), config),
  systemPrompt,
},
```

### 2d. Wire Tool Approval Into `wrapTool`

In [registry.ts](packages/agent/src/tools/registry.ts), add approval check before `def.execute()` at line 50:

```typescript
const WRITE_TOOLS = new Set(["bash", "write", "edit", "delete"]);

// Inside wrapTool execute, before def.execute:
if (ctx.requestUserInput && WRITE_TOOLS.has(def.id)) {
  const approval = await ctx.requestUserInput(def.id, args);
  if (approval.denied) return `Tool denied: ${approval.message ?? "User denied this action"}`;
  if (approval.updatedInput) args = approval.updatedInput;
}
```

### 2e. Generate Active Memory Even on Abort

In [custom-agent-backend.ts](packages/agent/src/custom-agent-backend.ts) lines 870-878, change the condition:

```typescript
if (conversationHistory.length > 5 && mode === "agent") {
  const cheapModel = getCheapModel(modelDef);
  activeMemory = await generateActiveMemory(
    conversationHistory,
    cheapModel,
    config,
    AbortSignal.timeout(15_000),
  );
}
```

Remove the `!linkedAbort.signal.aborted` guard so it fires on abort too. Use cheap model + shorter 15s timeout.

### 2f. Verify/Fix Pruning Message Shape

In [streaming.ts](packages/agent/src/streaming.ts) `pruneConversation()` (lines 158-173), the pruning only handles `Array.isArray(msg.content)` with `"output" in part`. If tool messages are strings, they pass through unpruned. Add a string-content fallback:

```typescript
if (msg.role === "tool" && typeof msg.content === "string") {
  return { ...msg, content: "[Old tool result content cleared]" } as unknown as ModelMessage;
}
```

---

## Phase 3: Add Missing Features

### 3a. JSONL Conversation Persistence

Create new file [persistence.ts](packages/agent/src/persistence.ts) (~80 lines):

- `appendMessage(threadDir, threadId, message)` -- appends a JSONL line
- `loadThread(threadDir, threadId)` -- reads and parses JSONL back into `ModelMessage[]`
- `getThreadPath(threadDir, threadId)` -- returns `.agentide/threads/{threadId}.jsonl`

Integration in `custom-agent-backend.ts`:

- After each `conversationHistory.push()`, call `appendMessage()`
- In `buildContextSeed`, if active memory is absent and messages are empty, attempt `loadThread()`

### 3b. Bash Command Blocklist

In [bash.ts](packages/agent/src/tools/bash.ts), add validation before `spawn()`:

```typescript
const BLOCKED_PATTERNS = [
  /\brm\s+(-\w*\s+)*-\w*r\w*\s+\//,   // rm -rf /
  /\bsudo\b/,
  /\bcurl\b.*\|\s*(ba)?sh/,
  /\beval\b/,
  />\s*\/etc\//,
];

const SENSITIVE_ENV_KEYS = [
  /API_KEY/i, /SECRET/i, /TOKEN/i, /PASSWORD/i, /CREDENTIAL/i,
  /^AWS_/, /^GITHUB_TOKEN$/, /^NPM_TOKEN$/,
];
```

- Check command against `BLOCKED_PATTERNS`, return error if matched
- Scrub `process.env` by filtering out keys matching `SENSITIVE_ENV_KEYS` before passing to `spawn()`
- Validate that explicit file paths in the command resolve within `workspacePath`

### 3c. Extract `runAgent` Into Smaller Functions

Split [custom-agent-backend.ts](packages/agent/src/custom-agent-backend.ts) `runAgent()` (lines 354-900):

- Extract `runReadOnlyMode()` -- the ask/plan/review loop (current lines 420-604)
- Extract `runAgentMode()` -- the full agent loop (current lines 605-863)
- Keep `runAgent()` as orchestrator: model resolution, system prompt, abort wiring, MCP init, context seed, dispatch to mode function, teardown, active memory generation, result reporting

This eliminates the duplicated streaming/retry/usage-tracking logic.

---

## Phase 4: Enable Offloading (already covered in 1c)

Handled in Phase 1c above -- 3 lines to enable the existing infrastructure.

---

## Impact Summary

- **Lines removed**: ~350 (dead episode code, dead context-manager functions, duplicate code)
- **Lines added**: ~250 (persistence, bash blocklist, cheap model, tool approval, pruning fix)
- **Net**: ~-100 lines
- **Compaction cost**: 5x cheaper (Haiku instead of Opus)
- **Sub-agent cost**: 5x cheaper
- **Working features**: tool approval, output offloading, active memory on abort, bash safety, persistence


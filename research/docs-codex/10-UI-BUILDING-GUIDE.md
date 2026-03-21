# Building UI on Top of Codex

Guide for integrating Codex into your own application UI.

## Choose Integration Path

| Path | Best For |
|------|----------|
| **Codex SDK** | Custom apps, CI, automation, simple streaming |
| **App Server** | Rich clients (VS Code), auth, approvals, history |
| **codex exec** | Scripts, pipelines, non-interactive |

## SDK Integration Pattern

```typescript
import { Codex } from "@openai/codex-sdk";

const codex = new Codex({ config: { model: "gpt-5.4-mini" } });
const thread = codex.startThread({ workingDirectory: process.cwd() });

// Buffered
const turn = await thread.run("Summarize the repo");
console.log(turn.finalResponse, turn.items);

// Streamed
const { events } = await thread.runStreamed("Fix the bug");
for await (const e of events) {
  if (e.type === "item.completed") renderItem(e.item);
  if (e.type === "turn.completed") showUsage(e.usage);
}
```

## Key UI Concerns

### 1. Streaming vs Buffered

- **run()**: Waits for full turn. Simpler, good for "run and show result".
- **runStreamed()**: Real-time events. Better UX for long tasks.

### 2. Thread Persistence

Threads live in `~/.codex/sessions`. Use `resumeThread(id)` to restore. Store `threadId` in your app state.

### 3. Structured Output

Use `outputSchema` for predictable JSON (summaries, status, metadata):

```typescript
const turn = await thread.run("Summarize", {
  outputSchema: { type: "object", properties: { summary: { type: "string" } }, required: ["summary"] }
});
const data = JSON.parse(turn.finalResponse);
```

### 4. Images

Pass local images via structured input:

```typescript
await thread.run([
  { type: "text", text: "What's wrong with this UI?" },
  { type: "local_image", path: "./screenshot.png" }
]);
```

### 5. Approvals

Default: Codex asks for approval before running commands. For headless/CI, set `approval_policy: "never"` in config.

### 6. Sandbox

- **workspace-write**: Normal dev (default)
- **read-only**: Review, triage
- **danger-full-access**: Only in trusted env

## App Server for Rich Clients

If you need:

- User authentication
- Conversation history
- Approval flows
- Fine-grained streaming (item-level)

Use **App Server** (JSON-RPC 2.0). See [04-APP-SERVER](04-APP-SERVER.md).

## Error Handling

- SDK throws on `turn.failed`-style errors
- Check `turn.items` for partial results on failure
- Use try/catch around `run()` and `runStreamed()`

## Example: Simple Chat UI

```typescript
const thread = codex.startThread();
const { events } = await thread.runStreamed(userMessage);

for await (const e of events) {
  if (e.type === "item.completed" && e.item.type === "agent_message")
    appendToChat(e.item.content);
  if (e.type === "turn.completed")
    showDone(e.usage);
}
```

## Resources

- [Codex SDK](https://developers.openai.com/codex/sdk)
- [TypeScript Repo](https://github.com/openai/codex/tree/main/sdk/typescript)
- [Codex Changelog](https://developers.openai.com/codex/changelog)

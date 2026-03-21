# Building UI on Top of OpenCode

Guide for integrating OpenCode into your own application.

## Choose Integration Path

| Path | Best For |
|------|----------|
| **createOpencode()** | Full control. Start server + client. |
| **createOpencodeClient()** | Connect to existing server (TUI, opencode serve). |

## Basic Flow

```typescript
import { createOpencode } from "@opencode-ai/sdk";

const { client } = await createOpencode({ port: 4096 });

const session = await client.session.create({ body: { title: "Chat" } });
const result = await client.session.prompt({
  path: { id: session.id },
  body: {
    parts: [{ type: "text", text: userMessage }],
  },
});

const aiResponse = result.data.info.parts
  .filter((p) => p.type === "text")
  .map((p) => p.text)
  .join("");
```

## Key UI Concerns

### 1. Session Management

- Create session per conversation or reuse
- List sessions: `client.session.list()`
- Get messages: `client.session.messages({ path: { id } })`

### 2. Streaming

Use `event.subscribe()` for real-time updates:

```typescript
const events = await client.event.subscribe();
for await (const event of events.stream) {
  if (event.type === "message.delta") {
    appendToChat(event.properties);
  }
}
```

### 3. Structured Output

Use `format` with JSON schema for predictable responses (summaries, metadata, etc.). See [05-STRUCTURED-OUTPUT](05-STRUCTURED-OUTPUT.md).

### 4. Permissions

When agent requests permission (edit, bash, etc.), respond via:

```typescript
await client.postSessionByIdPermissionsByPermissionId({
  path: { id: sessionId, permissionId },
  body: { response: "allow", remember: true },
});
```

### 5. Context Injection

Use `noReply: true` to inject system context without triggering a reply:

```typescript
await client.session.prompt({
  path: { id: session.id },
  body: {
    noReply: true,
    parts: [{ type: "text", text: "You are a code reviewer. Focus on security." }],
  },
});
```

### 6. File Search

Integrate search into your UI:

```typescript
const matches = await client.find.text({ query: { pattern: userQuery } });
const files = await client.find.files({ query: { query: "*.ts", type: "file" } });
```

## Example: Simple Chat Loop

```typescript
const session = await client.session.create({ body: { title: "Chat" } });

async function sendMessage(text: string) {
  const result = await client.session.prompt({
    path: { id: session.id },
    body: { parts: [{ type: "text", text }] },
  });
  return result.data.info.parts
    .filter((p) => p.type === "text")
    .map((p) => p.text)
    .join("");
}
```

## Resources

- [SDK Docs](https://opencode.ai/docs/sdk/)
- [Server Docs](https://opencode.ai/docs/server)
- [Ecosystem Projects](https://opencode.ai/docs/ecosystem#projects)
- [Config](https://opencode.ai/docs/config)

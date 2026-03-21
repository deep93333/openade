# Sessions API

Core API for conversations and agent interactions.

## CRUD

| Method | Description | Response |
|--------|-------------|----------|
| session.list() | List all sessions | Session[] |
| session.get({ path: { id } }) | Get session | Session |
| session.children({ path: { id } }) | List child sessions | Session[] |
| session.create({ body }) | Create session | Session |
| session.delete({ path: { id } }) | Delete session | boolean |
| session.update({ path, body }) | Update properties | Session |

## Create Session

```typescript
const session = await client.session.create({
  body: { title: "My session" },
});
```

## Send Prompt

```typescript
const result = await client.session.prompt({
  path: { id: session.id },
  body: {
    model: { providerID: "anthropic", modelID: "claude-3-5-sonnet-20241022" },
    parts: [{ type: "text", text: "Hello!" }],
  },
});
```

### noReply (Context Only)

Inject context without triggering AI response:

```typescript
await client.session.prompt({
  path: { id: session.id },
  body: {
    noReply: true,
    parts: [{ type: "text", text: "You are a helpful assistant." }],
  },
});
```

### Structured Output

Use `body.format` for JSON schema. See [05-STRUCTURED-OUTPUT](05-STRUCTURED-OUTPUT.md).

## Other Session Methods

| Method | Description | Response |
|--------|-------------|----------|
| session.init({ path, body }) | Analyze app, create AGENTS.md | boolean |
| session.abort({ path }) | Abort running session | boolean |
| session.share({ path }) | Share session | Session |
| session.unshare({ path }) | Unshare session | Session |
| session.summarize({ path, body }) | Summarize session | boolean |
| session.revert({ path, body }) | Revert a message | Session |
| session.unrevert({ path }) | Restore reverted messages | Session |
| postSessionByIdPermissionsByPermissionId({ path, body }) | Respond to permission request | boolean |

## Messages

| Method | Description | Response |
|--------|-------------|----------|
| session.messages({ path }) | List messages | { info: Message, parts: Part[] }[] |
| session.message({ path }) | Get message details | { info: Message, parts: Part[] } |

## Commands and Shell

| Method | Description | Response |
|--------|-------------|----------|
| session.command({ path, body }) | Execute slash command | { info: AssistantMessage, parts: Part[] } |
| session.shell({ path, body }) | Run shell command | AssistantMessage |

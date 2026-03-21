# Other APIs

## Global

| Method | Description | Response |
|--------|-------------|----------|
| global.health() | Check server health and version | { healthy: true, version: string } |

## App

| Method | Description | Response |
|--------|-------------|----------|
| app.log({ body }) | Write log entry | boolean |
| app.agents() | List available agents | Agent[] |

## Project

| Method | Description | Response |
|--------|-------------|----------|
| project.list() | List all projects | Project[] |
| project.current() | Get current project | Project |

## Path

| Method | Description | Response |
|--------|-------------|----------|
| path.get() | Get current path | Path |

## Config

| Method | Description | Response |
|--------|-------------|----------|
| config.get() | Get config info | Config |
| config.providers() | List providers and default models | { providers, default } |

## TUI

Control TUI when running alongside SDK:

| Method | Description | Response |
|--------|-------------|----------|
| tui.appendPrompt({ body }) | Append text to prompt | boolean |
| tui.openHelp() | Open help dialog | boolean |
| tui.openSessions() | Open session selector | boolean |
| tui.openThemes() | Open theme selector | boolean |
| tui.openModels() | Open model selector | boolean |
| tui.submitPrompt() | Submit current prompt | boolean |
| tui.clearPrompt() | Clear prompt | boolean |
| tui.executeCommand({ body }) | Execute command | boolean |
| tui.showToast({ body }) | Show toast | boolean |

## Auth

| Method | Description | Response |
|--------|-------------|----------|
| auth.set({ path, body }) | Set credentials | boolean |

```typescript
await client.auth.set({
  path: { id: "anthropic" },
  body: { type: "api", key: "your-api-key" },
});
```

## Events

Server-sent events stream:

```typescript
const events = await client.event.subscribe();
for await (const event of events.stream) {
  console.log("Event:", event.type, event.properties);
}
```

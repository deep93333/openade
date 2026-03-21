# Codex App Server

Deep integration for rich clients (e.g. VS Code extension). Use when you need authentication, conversation history, approvals, and streamed agent events.

**For CI/automation**: Use [Codex SDK](02-TYPESCRIPT-SDK.md) instead.

## Protocol

- **JSON-RPC 2.0** (header omitted on wire)
- **Transports**: stdio (default), WebSocket (experimental)

## Start Server

```bash
codex app-server
# or
codex app-server --listen ws://127.0.0.1:4500
```

## Generate Schemas

```bash
codex app-server generate-ts --out ./schemas
codex app-server generate-json-schema --out ./schemas
```

## Core Primitives

- **Item**: Unit of input/output (message, command, file change, tool call)
- **Turn**: Single user request + agent work. Contains items.
- **Thread**: Conversation. Contains turns.

## Lifecycle

1. **Initialize**: Send `initialize` + `initialized` before any other method
2. **Start thread**: `thread/start` or `thread/resume` or `thread/fork`
3. **Start turn**: `turn/start` with threadId + input
4. **Stream**: Read notifications (item/started, item/completed, etc.)
5. **Steer**: `turn/steer` to append input mid-turn
6. **Interrupt**: `turn/interrupt` to cancel
7. **Complete**: Server emits `turn/completed`

## Key Methods

| Method | Description |
|--------|-------------|
| initialize | Client handshake (required first) |
| thread/start | New thread |
| thread/resume | Continue existing |
| thread/fork | Branch history |
| turn/start | Begin turn |
| turn/steer | Append input |
| turn/interrupt | Cancel |

## Initialize

```json
{
  "method": "initialize",
  "id": 0,
  "params": {
    "clientInfo": {
      "name": "my_product",
      "title": "My Product",
      "version": "0.1.0"
    },
    "capabilities": {
      "experimentalApi": true,
      "optOutNotificationMethods": ["thread/started", "item/agentMessage/delta"]
    }
  }
}
```

## Experimental API

Set `capabilities.experimentalApi: true` for experimental methods.

## WebSocket Overload

When full, server rejects with `-32001` "Server overloaded; retry later." Retry with exponential backoff.

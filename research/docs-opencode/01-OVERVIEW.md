# OpenCode SDK - Overview

## What It Is

The OpenCode JS/TS SDK provides a **type-safe client** for interacting with the OpenCode server. Use it to:

- Build integrations and control OpenCode programmatically
- Create custom UIs on top of OpenCode
- Automate coding workflows

## Architecture

OpenCode runs a **headless HTTP server** (`opencode serve`) that exposes an OpenAPI endpoint. The SDK is a generated client for that API.

- **TUI + Server**: Running `opencode` starts both TUI and server
- **Standalone Server**: `opencode serve` runs server only
- **SDK**: Connects to server via HTTP

## Installation

```bash
npm install @opencode-ai/sdk
```

## Minimal Example

```typescript
import { createOpencode } from "@opencode-ai/sdk";

const { client } = await createOpencode();

const health = await client.global.health();
console.log(health.data.version);

const session = await client.session.create({ body: { title: "My session" } });
const result = await client.session.prompt({
  path: { id: session.id },
  body: {
    parts: [{ type: "text", text: "Hello!" }],
  },
});
```

## Two Modes

| Mode | Use Case |
|------|----------|
| **createOpencode()** | Start server + client. Full control. |
| **createOpencodeClient()** | Client only. Server already running (TUI, `opencode serve`). |

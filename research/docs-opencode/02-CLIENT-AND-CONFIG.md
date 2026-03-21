# Client and Config

## createOpencode()

Starts both server and client.

```typescript
import { createOpencode } from "@opencode-ai/sdk";

const { client, server } = await createOpencode({
  hostname: "127.0.0.1",
  port: 4096,
  config: {
    model: "anthropic/claude-3-5-sonnet-20241022",
  },
});

console.log(`Server at ${server.url}`);
client.global.health();
server.close();
```

### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| hostname | string | Server hostname | 127.0.0.1 |
| port | number | Server port | 4096 |
| signal | AbortSignal | Abort signal for cancellation | undefined |
| timeout | number | Timeout in ms for server start | 5000 |
| config | Config | Configuration object | {} |

Config is merged with `opencode.json`. Inline config overrides file config.

## createOpencodeClient()

Client only. Connect to existing server.

```typescript
import { createOpencodeClient } from "@opencode-ai/sdk";

const client = createOpencodeClient({
  baseUrl: "http://localhost:4096",
});
```

### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| baseUrl | string | URL of the server | http://localhost:4096 |
| fetch | function | Custom fetch implementation | globalThis.fetch |
| parseAs | string | Response parsing method | auto |
| responseStyle | string | Return style: data or fields | fields |
| throwOnError | boolean | Throw errors instead of return | false |

## Config Object

Pass to `createOpencode({ config })`. Config is merged with `opencode.json` (project) and `~/.config/opencode/opencode.json` (global). Inline overrides file config.

```typescript
{
  model: "anthropic/claude-3-5-sonnet-20241022",
  provider: { /* ... */ },
  tools: { write: false, bash: false },
  permission: { edit: "ask", bash: "ask" },
}
```

Config supports JSON and JSONC. Schema: [opencode.ai/config.json](https://opencode.ai/config.json). See [opencode.ai/docs/config](https://opencode.ai/docs/config) for full options.

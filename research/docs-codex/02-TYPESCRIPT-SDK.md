# Codex TypeScript SDK - API Reference

## Codex Class

```typescript
const codex = new Codex(options?);
```

### Options

```typescript
{
  env?: Record<string, string>;  // Full control of CLI environment
  config?: Record<string, unknown>;  // --config overrides (flattened to dotted paths)
  baseUrl?: string;  // Passed as --config openai_base_url=...
}
```

**env**: By default CLI inherits Node.js process env. Use for sandboxed hosts (e.g. Electron). SDK still injects `CODEX_API_KEY` etc.

**config**: Flattened to dotted paths, serialized as TOML:

```typescript
config: {
  show_raw_agent_reasoning: true,
  sandbox_workspace_write: { network_access: true }
}
```

## startThread()

```typescript
const thread = codex.startThread(options?);
```

### Thread Options

```typescript
{
  workingDirectory?: string;
  skipGitRepoCheck?: boolean;  // Codex requires Git repo by default
}
```

## resumeThread()

```typescript
const thread = codex.resumeThread(threadId: string);
```

## Thread.run()

```typescript
const turn = await thread.run(input, options?);
```

### Input

- **string**: `"Diagnose the test failure"`
- **array**: Structured entries for text + images:

```typescript
[
  { type: "text", text: "Describe these screenshots" },
  { type: "local_image", path: "./ui.png" },
  { type: "local_image", path: "./diagram.jpg" }
]
```

### Options

```typescript
{
  outputSchema?: object;  // JSON Schema for structured output
}
```

### Return

```typescript
{
  finalResponse: string;
  items: Item[];  // Agent messages, commands, file changes, etc.
}
```

## Thread.runStreamed()

Returns async generator of events. Use for real-time progress:

```typescript
const { events } = await thread.runStreamed("Diagnose the test failure");

for await (const event of events) {
  switch (event.type) {
    case "item.completed":
      console.log("item", event.item);
      break;
    case "turn.completed":
      console.log("usage", event.usage);
      break;
  }
}
```

## Structured Output

JSON Schema or Zod:

```typescript
const schema = {
  type: "object",
  properties: {
    summary: { type: "string" },
    status: { type: "string", enum: ["ok", "action_required"] }
  },
  required: ["summary", "status"],
  additionalProperties: false
} as const;

const turn = await thread.run("Summarize repository status", { outputSchema: schema });
```

With Zod:

```typescript
import { zodToJsonSchema } from "zod-to-json-schema";

const schema = z.object({
  summary: z.string(),
  status: z.enum(["ok", "action_required"])
});

const turn = await thread.run("Summarize repository status", {
  outputSchema: zodToJsonSchema(schema, { target: "openAi" })
});
```

## Session Persistence

Threads stored in `~/.codex/sessions`. Each thread has an ID; use `resumeThread(id)` to continue.

## Environment Control

The SDK spawns the Codex CLI. Use `env` to fully control the CLI environment (e.g. sandboxed hosts like Electron). The SDK still injects `CODEX_API_KEY` etc. on top of your env. Use `baseUrl` to pass `--config openai_base_url=...`.

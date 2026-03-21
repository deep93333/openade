# Types and Errors

## TypeScript Types

All API types are generated from the server's OpenAPI spec. Import directly:

```typescript
import type { Session, Message, Part } from "@opencode-ai/sdk";
```

Types are available in the SDK's types file. See the [OpenAPI spec](https://opencode.ai/docs/server#spec) for full schema.

## Error Handling

The SDK can throw errors. Catch and handle them:

```typescript
try {
  await client.session.get({ path: { id: "invalid-id" } });
} catch (error) {
  console.error("Failed to get session:", (error as Error).message);
}
```

## throwOnError

When using `createOpencodeClient`, set `throwOnError: true` to throw on API errors instead of returning error objects:

```typescript
const client = createOpencodeClient({
  baseUrl: "http://localhost:4096",
  throwOnError: true,
});
```

## Structured Output Errors

For structured output failures, check `result.data.info.error`:

```typescript
if (result.data.info.error?.name === "StructuredOutputError") {
  console.error(result.data.info.error.message);
  console.error("Retries:", result.data.info.error.retries);
}
```

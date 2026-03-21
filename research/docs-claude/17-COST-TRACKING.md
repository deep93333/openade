# Cost Tracking

## Total Cost

Result message has `total_cost_usd` - authoritative total for the query() call.

```typescript
if (message.type === "result") {
  console.log(`Total cost: $${message.total_cost_usd}`);
}
```

```python
if isinstance(message, ResultMessage):
    print(f"Total cost: ${message.total_cost_usd or 0}")
```

## Scope

- **Session**: Multiple query() calls linked by resume
- **Step**: Single request/response cycle
- **query() call**: One invocation; produces one result message

Each result reflects only that call's cost. Accumulate across calls yourself.

## TypeScript: Per-Step Usage

Assistant messages have `message.message.usage` with `input_tokens`, `output_tokens`.

**Deduplicate by message ID**: Parallel tool calls share same ID - count once.

## TypeScript: Per-Model Breakdown

Result message has `modelUsage`: map of model name to tokens and cost.

## Cache Tokens

- `cache_read_input_tokens`: From cache (reduced rate)
- `cache_creation_input_tokens`: Creating cache (higher rate)

## Failed Conversations

Result message includes cost even on error. Tokens consumed up to failure.

## Accumulate Across Calls

```typescript
let totalSpend = 0;
for (const prompt of prompts) {
  for await (const message of query({ prompt })) {
    if (message.type === "result") totalSpend += message.total_cost_usd ?? 0;
  }
}
```

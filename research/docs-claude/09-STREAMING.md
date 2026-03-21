# Streaming vs Single Message Input

## Streaming Input Mode (Recommended)

- Persistent, interactive session
- Image uploads
- Queued messages, interrupt support
- Full hooks, tools, MCP
- Real-time feedback
- Context persistence

### Implementation

```typescript
async function* generateMessages() {
  yield { type: "user", message: { role: "user", content: "Analyze codebase" } };
  await delay(2000);
  yield {
    type: "user",
    message: {
      role: "user",
      content: [
        { type: "text", text: "Review this diagram" },
        { type: "image", source: { type: "base64", media_type: "image/png", data: base64Data } }
      ]
    }
  };
}

for await (const message of query({ prompt: generateMessages(), options })) {
  if (message.type === "result") console.log(message.result);
}
```

### Python (ClaudeSDKClient)

```python
async def message_generator():
    yield {"type": "user", "message": {"role": "user", "content": "Analyze codebase"}}
    yield {"type": "user", "message": {"role": "user", "content": [...]}}

async with ClaudeSDKClient(options) as client:
    await client.query(message_generator())
    async for message in client.receive_response():
        ...
```

## Single Message Input

- Stateless (lambda, etc.)
- One-shot response
- No hooks, no image attachments, no interruption

### Implementation

```typescript
for await (const message of query({
  prompt: "Explain auth flow",
  options: { maxTurns: 1 }
})) { ... }

// Continue conversation
for await (const message of query({
  prompt: "Now explain authorization",
  options: { continue: true, maxTurns: 1 }
})) { ... }
```

## Custom MCP Tools

**Require streaming input**. Use async generator for prompt, not simple string.

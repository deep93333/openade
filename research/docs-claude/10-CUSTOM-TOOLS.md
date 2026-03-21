# Custom Tools

Build in-process MCP servers with createSdkMcpServer and tool().

## Creating a Tool

### TypeScript

```typescript
import { query, tool, createSdkMcpServer } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";

const customServer = createSdkMcpServer({
  name: "my-custom-tools",
  version: "1.0.0",
  tools: [
    tool(
      "get_weather",
      "Get current temperature for a location",
      {
        latitude: z.number(),
        longitude: z.number()
      },
      async (args) => ({
        content: [{ type: "text", text: `Temp: ${result}°F` }]
      })
    )
  ]
});
```

### Python

```python
@tool("get_weather", "Get current temperature", {"latitude": float, "longitude": float})
async def get_weather(args: dict) -> dict:
    return {"content": [{"type": "text", "text": f"Temp: {result}°F"}]}

custom_server = create_sdk_mcp_server(
    name="my-custom-tools",
    version="1.0.0",
    tools=[get_weather]
)
```

## Using Custom Tools

**Requires streaming input** - use async generator for prompt.

```typescript
options: {
  mcpServers: { "my-custom-tools": customServer },
  allowedTools: ["mcp__my-custom-tools__get_weather"]
}
```

## Tool Name Format

`mcp__{server_name}__{tool_name}`

## Schema Options (Python)

- Simple: `{"name": str, "age": int}`
- JSON Schema: `{"type": "object", "properties": {...}, "required": [...]}`

## Return Format

```typescript
return {
  content: [{ type: "text", text: "Result string" }]
};
```

## Error Handling

Return error as text content; don't throw. Claude sees the message.

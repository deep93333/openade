# MCP (Model Context Protocol)

Connect to external tools via the Model Context Protocol.

## Quickstart

```typescript
options: {
  mcpServers: {
    "claude-code-docs": {
      type: "http",
      url: "https://code.claude.com/docs/mcp"
    }
  },
  allowedTools: ["mcp__claude-code-docs__*"]
}
```

## Configuration

### In Code

```typescript
mcpServers: {
  filesystem: {
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-filesystem", "/path"]
  },
  github: {
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-github"],
    env: { GITHUB_TOKEN: process.env.GITHUB_TOKEN }
  }
}
```

### From .mcp.json

Create at project root:

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path"]
    }
  }
}
```

## Allow MCP Tools

MCP tools require explicit permission. Use `allowedTools`:

```typescript
allowedTools: [
  "mcp__github__*",
  "mcp__db__query",
  "mcp__slack__send_message"
]
```

Wildcard `*` allows all tools from a server.

## Transport Types

| Type | Use Case |
|------|----------|
| stdio | Local processes (command + args) |
| http | Remote APIs (type: "http", url) |
| sse | Streaming remote (type: "sse", url) |
| SDK | In-process via createSdkMcpServer |

## Authentication

### Environment Variables

```json
"env": { "GITHUB_TOKEN": "${GITHUB_TOKEN}" }
```

### HTTP Headers

```typescript
{
  type: "http",
  url: "https://api.example.com/mcp",
  headers: { Authorization: `Bearer ${process.env.API_TOKEN}` }
}
```

## MCP Tool Search

When tools exceed ~10% of context, tool search activates (Sonnet 4+, Opus 4+). Tools load on-demand.

**ENABLE_TOOL_SEARCH** env:
- `auto` - At 10% (default)
- `auto:5` - At 5%
- `true` - Always
- `false` - Disabled

## Error Handling

Check `system` message with `subtype === "init"` for `mcp_servers` status. Filter for `status !== "connected"` to detect failures.

## Tool Naming

Pattern: `mcp__{server_name}__{tool_name}`

Example: `mcp__playwright__browser_screenshot`

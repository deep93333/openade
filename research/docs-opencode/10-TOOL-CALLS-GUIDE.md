# Tool Calls - How They Work

How tool calls work in OpenCode and what tools are available.

## How Tool Calls Work

1. **Model decides**: The LLM chooses which tools to call during a session.
2. **Permission check**: Each tool has a permission (`allow`, `deny`, `ask`).
3. **Execution**: If allowed, the tool runs. If `ask`, user must approve via `postSessionByIdPermissionsByPermissionId`.
4. **Result**: Tool output is returned to the model for the next turn.

## Flow

```
session.prompt() → Model → tool call (e.g. edit) → Permission? → allow: execute | ask: wait for user | deny: skip
                                                                        ↓
                                                              Result → Model → next tool or response
```

## Permission Configuration

```json
{
  "permission": {
    "edit": "allow",
    "bash": "ask",
    "webfetch": "deny",
    "mymcp_*": "ask"
  }
}
```

| Value | Behavior |
|-------|----------|
| allow | Tool runs without prompting |
| deny | Tool is blocked |
| ask | User must approve via permissions API |

Wildcards: `mymcp_*` applies to all tools from that MCP server.

## Built-in Tools

| Tool | Description |
|------|-------------|
| bash | Execute shell commands |
| edit | Modify files using exact string replacements |
| write | Create new files or overwrite existing |
| read | Read file contents (supports line ranges) |
| grep | Search file contents with regex |
| glob | Find files by pattern |
| list | List files and directories |
| patch | Apply patches to files |
| skill | Load SKILL.md and return content |
| todowrite | Manage todo lists during sessions |
| todoread | Read existing todo lists |
| webfetch | Fetch web content |
| websearch | Search the web (requires OpenCode provider or OPENCODE_ENABLE_EXA) |
| question | Ask the user questions during execution |
| lsp | LSP operations (experimental, OPENCODE_EXPERIMENTAL_LSP_TOOL) |

## Tool Groups

**File modification** (controlled by `edit` permission): `edit`, `write`, `patch`, `multiedit`. The `write` tool is controlled by the `edit` permission in config.

## Disabling Tools

```json
{
  "tools": {
    "write": false,
    "bash": false
  }
}
```

## Responding to Permission Requests

When `permission` is `ask`, the SDK client must respond:

```typescript
await client.postSessionByIdPermissionsByPermissionId({
  path: { id: sessionId, permissionId },
  body: { response: "allow", remember: true },
});
```

## Custom Tools

Define in `.opencode/tools/` or `~/.config/opencode/tools/` using `tool()` from `@opencode-ai/plugin`. Tools are TypeScript/JavaScript files; the `execute` function can invoke scripts in any language. See [opencode.ai/docs/custom-tools](https://opencode.ai/docs/custom-tools).

## MCP Servers

Add external tools via `mcp` config. See [opencode.ai/docs/mcp-servers](https://opencode.ai/docs/mcp-servers).

## Question Tool

Lets the model ask the user questions (header, question text, options). Users select or type a custom answer. Useful for clarifying instructions or getting decisions.

## Cross-Framework Comparison

| Aspect | Claude Agent SDK | Codex | OpenCode |
|--------|------------------|-------|----------|
| Tool model | Explicit allow/deny lists | Opaque (agent internal) | Permission per tool |
| Approval | canUseTool callback | approval_policy, sandbox | postSessionByIdPermissionsByPermissionId |
| Restrict tools | allowedTools, disallowedTools | Sandbox mode | permission (allow/deny/ask), tools config |
| Custom tools | createSdkMcpServer, MCP | MCP in config.toml | Config, MCP servers |
| File ops | Read, Write, Edit | read, edit, write (internal) | read, edit, write, patch |
| Shell | Bash | bash (internal) | bash |
| Search | Glob, Grep | (internal) | glob, grep, list |
| Web | WebSearch, WebFetch | web search (cached/live) | webfetch, websearch |
| User input | AskUserQuestion | (approval prompts) | question |
| Special | Agent, Skill | Subagents, MCP as tool | skill, todowrite, todoread, lsp |

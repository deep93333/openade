# Tool Calls - How They Work

How tool calls work in Codex and what capabilities the agent has.

## How Tool Calls Work

Codex does **not** expose a tool-by-tool API to SDK consumers. The agent runs autonomously and uses internal tools. You interact via:

1. **Prompt**: Send a prompt; Codex plans and executes.
2. **Items**: `turn.items` contains agent output—messages, file changes, commands, tool calls.
3. **Approval**: When `approval_policy` is `on-request`, Codex pauses for user approval before running commands.
4. **Sandbox**: Limits what the agent can do (read-only, workspace-write, danger-full-access).

## Flow

```
User prompt → Codex agent → (internal tools: read, edit, bash, web search, MCP) → Items in turn
                ↓
         Approval needed? → User approves/rejects → Continue
```

## Agent Capabilities (Internal Tools)

Codex uses these capabilities internally. They appear as items in the transcript:

| Capability | Description |
|------------|-------------|
| **File read** | Read files in workspace |
| **File edit** | Edit files (patch, multiedit) |
| **File write** | Create/overwrite files |
| **Bash/shell** | Run terminal commands |
| **Web search** | Search the web (cached or live) |
| **MCP tools** | Tools from configured MCP servers |

## Approval Policy

Controls when Codex asks before running commands:

| Policy | Behavior |
|--------|----------|
| on-request | Default. Ask before running commands. |
| never | Auto-approve. Use for CI/automation. |
| untrusted | Ask for untrusted/sensitive operations. |

**SDK**: Pass via config or `--full-auto` in exec.

**App Server**: Client receives approval notifications; responds via RPC.

## Sandbox Modes

| Mode | File access | Network | Commands |
|------|-------------|---------|----------|
| workspace-write | Read/write workspace | Limited | Yes (sandboxed) |
| read-only | Read only | No | No |
| danger-full-access | Full | Yes | Yes (unrestricted) |

## Web Search

- **Default**: Cached results (OpenAI index).
- **Live**: Set `web_search = "live"` or pass `--search`.
- **Disabled**: Set `web_search = "disabled"`.

## MCP Servers

Add external tools via `config.toml`:

```toml
[mcp_servers.context7]
command = "npx"
args = ["-y", "@upstash/context7-mcp"]
```

Codex exposes MCP tools to the agent. Use `enabled_tools` / `disabled_tools` to filter.

## Items in Turn Output

When using `thread.run()` or `runStreamed()`, `turn.items` includes:

- Agent messages
- File changes (patches, writes)
- Command executions
- Tool call results (e.g. web search)
- Approval requests (when applicable)

## Codex as MCP Tool

Codex can run as an MCP server (`codex mcp-server`), exposing:

- **codex**: Start a Codex session. Params: `prompt`, `sandbox`, `approval-policy`, `cwd`, etc.
- **codex-reply**: Continue session with `threadId` + `prompt`.

Used when orchestrating Codex from the OpenAI Agents SDK.

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

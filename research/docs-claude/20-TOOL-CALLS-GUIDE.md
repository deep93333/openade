# Tool Calls - How They Work

How tool calls work in the Claude Agent SDK and what tools are available.

## How Tool Calls Work

1. **Agent loop**: Claude receives your prompt and decides which tools to call.
2. **Tool execution**: Built-in tools (Read, Edit, Bash, etc.) run automatically. No custom executor needed.
3. **Approval**: If `permissionMode` is `default` and the tool isn't pre-approved, `canUseTool` fires.
4. **Result**: Tool output is fed back to Claude. Claude may call more tools or return a final response.
5. **Streaming**: In streaming mode, `tool_use` blocks appear as they're requested; `result` blocks follow execution.

## Flow Diagram

```
User prompt → Claude → tool_use (Read) → canUseTool? → Execute → result → Claude → tool_use (Edit) → ...
```

## Permission Modes

| Mode | Behavior |
|------|----------|
| default | Unmatched tools → canUseTool callback |
| dontAsk | Deny anything not in allowedTools (TS only) |
| bypassPermissions | All tools run without prompts |
| plan | No tool execution; planning only |

## Restricting Tools

```typescript
options: {
  allowedTools: ["Read", "Glob", "Grep"],
  disallowedTools: ["Bash"],
}
```

`allowedTools` = allowlist. `disallowedTools` = blocklist (always denied).

## Approval (canUseTool)

When Claude requests a tool not auto-approved:

```typescript
canUseTool: async (toolName, input) => {
  if (toolName === "AskUserQuestion") return handleQuestions(input);
  const approved = await showApprovalDialog(toolName, input);
  return approved
    ? { behavior: "allow", updatedInput: input }
    : { behavior: "deny", message: "User rejected" };
}
```

## Built-in Tools

| Tool | Description |
|------|-------------|
| Read | Read any file in the working directory |
| Write | Create new files |
| Edit | Make precise edits to existing files |
| Bash | Run terminal commands, scripts, git operations |
| Glob | Find files by pattern (`**/*.ts`, `src/**/*.py`) |
| Grep | Search file contents with regex |
| WebSearch | Search the web for current information |
| WebFetch | Fetch and parse web page content |
| AskUserQuestion | Ask user clarifying questions with multiple choice |
| Agent | Invoke subagents |
| Skill | Invoke Agent Skills (requires settingSources) |

## Tool Input Schemas (for canUseTool)

| Tool | Input Fields |
|------|--------------|
| Bash | `command`, `description`, `timeout` |
| Write | `file_path`, `content` |
| Edit | `file_path`, `old_string`, `new_string` |
| Read | `file_path`, `offset`, `limit` |

## MCP Tools

External tools via Model Context Protocol. Naming: `mcp__{server_name}__{tool_name}`.

```typescript
allowedTools: ["mcp__github__list_issues", "mcp__my-server__*"]
```

## Custom Tools

Use `createSdkMcpServer` + `tool()` for in-process tools. See [10-CUSTOM-TOOLS](10-CUSTOM-TOOLS.md).

## Tool Combinations by Use Case

| Use Case | Tools |
|----------|-------|
| Read-only analysis | Read, Glob, Grep |
| Analyze and modify code | Read, Edit, Glob |
| Full automation | Read, Edit, Bash, Glob, Grep |
| Web research | Add WebSearch, WebFetch |

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

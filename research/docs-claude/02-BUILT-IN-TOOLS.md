# Built-in Tools

Tools control what your agent can do. All built-in tools are available without implementing tool execution.

## Tool Reference

| Tool | Description |
|------|-------------|
| **Read** | Read any file in the working directory |
| **Write** | Create new files |
| **Edit** | Make precise edits to existing files |
| **Bash** | Run terminal commands, scripts, git operations |
| **Glob** | Find files by pattern (`**/*.ts`, `src/**/*.py`) |
| **Grep** | Search file contents with regex |
| **WebSearch** | Search the web for current information |
| **WebFetch** | Fetch and parse web page content |
| **AskUserQuestion** | Ask user clarifying questions with multiple choice |
| **Agent** | Invoke subagents |
| **Skill** | Invoke Agent Skills (requires settingSources) |

## Tool Combinations by Use Case

| Use Case | Tools |
|----------|-------|
| Read-only analysis | `Read`, `Glob`, `Grep` |
| Analyze and modify code | `Read`, `Edit`, `Glob` |
| Full automation | `Read`, `Edit`, `Bash`, `Glob`, `Grep` |
| Web research | Add `WebSearch`, `WebFetch` |

## Tool Input Schemas (for canUseTool)

| Tool | Input Fields |
|------|--------------|
| Bash | `command`, `description`, `timeout` |
| Write | `file_path`, `content` |
| Edit | `file_path`, `old_string`, `new_string` |
| Read | `file_path`, `offset`, `limit` |

## Example: TODO Search

```typescript
for await (const message of query({
  prompt: "Find all TODO comments and create a summary",
  options: { allowedTools: ["Read", "Glob", "Grep"] }
})) {
  if ("result" in message) console.log(message.result);
}
```

```python
async for message in query(
    prompt="Find all TODO comments and create a summary",
    options=ClaudeAgentOptions(allowed_tools=["Read", "Glob", "Grep"]),
):
    if hasattr(message, "result"):
        print(message.result)
```

## MCP Tool Naming

MCP tools follow: `mcp__{server_name}__{tool_name}`

Example: `mcp__github__list_issues`

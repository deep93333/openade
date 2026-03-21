# Hooks

Intercept and customize agent behavior at key execution points.

## How Hooks Work

1. Event fires (PreToolUse, PostToolUse, etc.)
2. SDK collects registered hooks
3. Matchers filter which hooks run (regex against tool name)
4. Callback executes with input data
5. Callback returns decision (allow, deny, modify)

## Available Hooks

| Hook | Python | TypeScript | Triggers |
|------|--------|------------|----------|
| PreToolUse | ✓ | ✓ | Tool call request (block/modify) |
| PostToolUse | ✓ | ✓ | Tool execution result |
| PostToolUseFailure | ✓ | ✓ | Tool execution failure |
| UserPromptSubmit | ✓ | ✓ | User prompt submission |
| Stop | ✓ | ✓ | Agent execution stop |
| SubagentStart | ✓ | ✓ | Subagent initialization |
| SubagentStop | ✓ | ✓ | Subagent completion |
| PreCompact | ✓ | ✓ | Conversation compaction |
| PermissionRequest | ✓ | ✓ | Permission dialog would display |
| Notification | ✓ | ✓ | permission_prompt, idle_prompt, auth_success, elicitation_dialog |
| SessionStart | ✗ | ✓ | Session initialization |
| SessionEnd | ✗ | ✓ | Session termination |
| TeammateIdle | ✗ | ✓ | Teammate becomes idle (TS only) |

## Configuration

```typescript
options: {
  hooks: {
    PreToolUse: [{ matcher: "Write|Edit", hooks: [myCallback] }]
  }
}
```

```python
ClaudeAgentOptions(
    hooks={
        "PreToolUse": [HookMatcher(matcher="Write|Edit", hooks=[my_callback])]
    }
)
```

## Matcher Patterns

- `"Bash"` - Only Bash commands
- `"Write|Edit"` - File modification tools
- `"^mcp__"` - All MCP tools
- Omit matcher - Run for every event

**Note**: Matchers match tool names only, not file paths. Check `tool_input.file_path` inside callback for path filtering.

## Callback Inputs

- **input_data**: Tool name, tool_input, session_id, cwd, hook_event_name
- **tool_use_id**: Correlates PreToolUse and PostToolUse
- **context**: `{ signal }` (TypeScript AbortSignal)

## Callback Outputs

### PreToolUse hookSpecificOutput

```typescript
{
  permissionDecision: "allow" | "deny" | "ask",
  permissionDecisionReason?: string,
  updatedInput?: Record<string, unknown>  // Modified tool input
}
```

### Top-level fields

- `systemMessage`: Inject message into conversation
- `continue` / `continue_`: Keep agent running
- `async` / `async_`: Don't wait for hook (side effects only)

## Block .env Files Example

```typescript
const protectEnvFiles: HookCallback = async (input) => {
  const toolInput = (input as PreToolUseHookInput).tool_input as Record<string, unknown>;
  const fileName = (toolInput?.file_path as string)?.split("/").pop();
  if (fileName === ".env") {
    return {
      hookSpecificOutput: {
        hookEventName: input.hook_event_name,
        permissionDecision: "deny",
        permissionDecisionReason: "Cannot modify .env files"
      }
    };
  }
  return {};
};
```

## Modify Tool Input (Redirect to Sandbox)

```typescript
return {
  hookSpecificOutput: {
    permissionDecision: "allow",
    updatedInput: { ...toolInput, file_path: `/sandbox${originalPath}` }
  }
};
```

## Async Output (Non-blocking)

Return `{ async: true, asyncTimeout: 30000 }` - agent proceeds immediately. Use for logging, webhooks. Cannot block or modify.

## Chain Multiple Hooks

Hooks execute in array order. Deny takes priority over ask over allow.

## Session Hooks in Python

`SessionStart` and `SessionEnd` are TypeScript-only as SDK callbacks. In Python, use shell command hooks via `setting_sources=["project"]` to load from `.claude/settings.json`.

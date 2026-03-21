# Building UI on Top of Claude Agent SDK

Guide for building a user interface that wraps the Claude Agent SDK.

## Architecture Overview

```
[Your UI] ←→ [SDK query()] ←→ [Claude API]
     ↑              ↑
     |              └── Tools (Read, Edit, Bash, etc.)
     |
     └── Messages stream: system, assistant, result
```

## 1. Message Stream Handling

### Message Types

| Type | Subtype | Use For |
|------|---------|---------|
| system | init | Session start, available tools, plugins |
| system | compact_boundary | Compaction completed |
| assistant | - | Claude's reasoning, tool calls |
| result | success | Final result, session_id, total_cost_usd |
| result | error_* | Error details |

### Filtering for Display

```typescript
for await (const message of query({ prompt, options })) {
  switch (message.type) {
    case "assistant":
      for (const block of message.message?.content ?? []) {
        if ("text" in block) appendToChat(block.text);
        if (block.type === "tool_use") showToolCall(block.name, block.input);
      }
      break;
    case "result":
      if (message.subtype === "success") showResult(message.result);
      saveSessionId(message.session_id);
      showCost(message.total_cost_usd);
      break;
  }
}
```

## 2. Approval UI (canUseTool)

When Claude needs permission, `canUseTool` fires. Your UI must:

1. Display the request (tool name, input)
2. Collect user decision (allow/deny)
3. Return synchronously (or via Promise)

```typescript
canUseTool: async (toolName, input) => {
  const decision = await showApprovalDialog({
    tool: toolName,
    ...input,
    onAllow: () => ({ behavior: "allow", updatedInput: input }),
    onDeny: (msg) => ({ behavior: "deny", message: msg })
  });
  return decision;
}
```

**Python**: Requires streaming input + PreToolUse hook with `{"continue_": True}`.

## 3. Clarifying Questions (AskUserQuestion)

When `toolName === "AskUserQuestion"`:

1. Parse `input.questions` - array of { question, header, options, multiSelect }
2. Render form/dialog with options
3. Return `{ behavior: "allow", updatedInput: { questions, answers } }`
4. answers: `{ "question text": "selected label" }`

## 4. Session Management

### Multi-Turn Chat

- **Python**: Use `ClaudeSDKClient` - holds session across `client.query()` calls
- **TypeScript**: Use `continue: true` on subsequent query() calls

### Resume Specific Session

Capture `session_id` from result message. Pass `resume: sessionId` for follow-up.

### Session List

Use `listSessions(cwd)` and `getSessionMessages(sessionId)` for session picker UI.

## 5. Streaming Input for Rich UX

For image uploads, queued messages, interruption:

```typescript
async function* messageStream() {
  while (true) {
    const msg = await getUserMessage();
    if (msg.cancel) break;
    yield { type: "user", message: { role: "user", content: msg.content } };
  }
}
```

## 6. Cost Display

Read `total_cost_usd` from result message. Accumulate across calls for session total.

## 7. Error Handling

- `result.subtype === "error_max_turns"` - Hit turn limit
- `result.subtype === "error_max_budget_usd"` - Hit budget
- `result.subtype === "error_during_execution"` - Execution error

Resume with higher limits if needed.

## 8. Permission Modes for UI

| Mode | UI Behavior |
|------|-------------|
| default | Show approval for non-preapproved tools |
| acceptEdits | Auto-approve file ops; prompt for Bash etc. |
| dontAsk | No prompts; deny anything not in allowedTools |
| plan | No execution; show plan only |

## 9. Real-Time Updates

Stream assistant message blocks as they arrive. Show "thinking" for text, "running X" for tool_use.

## 10. Subagent Indication

Check `message.parent_tool_use_id` - if set, message is from subagent. Optionally show nested/indented in UI.

## Key Options for UI

```typescript
{
  allowedTools: ["Read", "Edit", "Glob", "Bash", "AskUserQuestion"],
  permissionMode: "default",
  canUseTool: yourApprovalHandler,
  maxTurns: 20,
  cwd: "/project/path"
}
```

## Example Flow

1. User sends message → yield to query()
2. Stream assistant messages → append to chat
3. Tool use block → show "Running: Read src/auth.ts"
4. canUseTool fires → show approval dialog
5. User allows → return { behavior: "allow" }
6. Result message → show final output, save session_id

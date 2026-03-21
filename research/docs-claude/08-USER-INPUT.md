# User Input (Approvals & Clarifying Questions)

Surface Claude's approval requests and clarifying questions to users.

## canUseTool Callback

Fires when Claude needs:
1. **Tool approval** - Tool not auto-approved
2. **Clarifying question** - AskUserQuestion tool

```typescript
canUseTool: async (toolName, input) => {
  if (toolName === "AskUserQuestion") return handleQuestions(input);
  return promptForApproval(toolName, input);
}
```

## Tool Approval Response

```typescript
// Allow
return { behavior: "allow", updatedInput: input };

// Deny
return { behavior: "deny", message: "User rejected" };
```

```python
return PermissionResultAllow(updated_input=input_data)
return PermissionResultDeny(message="User rejected")
```

## Approve with Changes

Modify input before allowing:

```typescript
return {
  behavior: "allow",
  updatedInput: { ...input, command: input.command.replace("/tmp", "/sandbox") }
};
```

## AskUserQuestion

Include `AskUserQuestion` in tools when restricting. Input structure:

```json
{
  "questions": [
    {
      "question": "How should I format the output?",
      "header": "Format",
      "options": [
        { "label": "Summary", "description": "Brief overview" },
        { "label": "Detailed", "description": "Full explanation" }
      ],
      "multiSelect": false
    }
  ]
}
```

## Response Format for AskUserQuestion

```typescript
return {
  behavior: "allow",
  updatedInput: {
    questions: input.questions,
    answers: {
      "How should I format the output?": "Summary",
      "Which sections?": "Introduction, Conclusion"
    }
  }
};
```

Keys = question text. Values = selected option label(s). Multi-select: join with ", ".

## Python Requirement

`can_use_tool` requires streaming mode + PreToolUse hook returning `{"continue_": True}` to keep stream open.

## Option Previews (TypeScript)

`toolConfig.askUserQuestion.previewFormat: "html"` adds `preview` to options for visual mockups.

## Limits

- 1-4 questions per call, 2-4 options each
- AskUserQuestion not available in subagents

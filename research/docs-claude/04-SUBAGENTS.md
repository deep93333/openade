# Subagents

Spawn specialized agents for focused subtasks. Main agent delegates; subagents report back.

## Creating Subagents

### Programmatic (Recommended)

```typescript
options: {
  allowedTools: ["Read", "Grep", "Glob", "Agent"],
  agents: {
    "code-reviewer": {
      description: "Expert code reviewer for quality and security.",
      prompt: "Analyze code quality and suggest improvements.",
      tools: ["Read", "Grep", "Glob"],
      model: "sonnet"
    }
  }
}
```

```python
AgentDefinition(
    description="Expert code reviewer for quality and security.",
    prompt="Analyze code quality and suggest improvements.",
    tools=["Read", "Grep", "Glob"],
    model="sonnet"
)
```

## AgentDefinition Fields

| Field | Required | Description |
|-------|----------|-------------|
| description | Yes | When to use this agent |
| prompt | Yes | System prompt / behavior |
| tools | No | Tool subset; omit = inherit all |
| model | No | sonnet, opus, haiku, inherit |

**Important**: Include `Agent` in `allowedTools`. Subagents cannot spawn subagents.

## Invocation

- **Automatic**: Claude matches task to description
- **Explicit**: "Use the code-reviewer agent to..."

## What Subagents Inherit

| Receives | Does NOT Receive |
|----------|------------------|
| Own system prompt + Agent tool prompt | Parent conversation history |
| Project CLAUDE.md (if settingSources) | Parent system prompt |
| Tool definitions (or subset) | Skills (unless in AgentDefinition.skills) |

## Detecting Subagent Invocation

Check for `tool_use` blocks where `name` is `"Agent"` or `"Task"` (legacy). Messages from subagent context have `parent_tool_use_id`.

## Resuming Subagents

1. Capture `session_id` and `agentId` from first query
2. Second query: `resume: sessionId`, prompt: "Resume agent {agentId} and..."
3. Pass same `agents` definition if custom

## Tool Restrictions

| Use Case | Tools |
|----------|-------|
| Read-only analysis | Read, Grep, Glob |
| Test execution | Bash, Read, Grep |
| Code modification | Read, Edit, Write, Grep, Glob |
| Full access | Omit tools field |

## Filesystem-based Agents

Define in `.claude/agents/` as markdown. Programmatic takes precedence for same name.

## Built-in General-Purpose

Claude can invoke built-in `general-purpose` subagent when `Agent` is in allowedTools, without defining custom agents.

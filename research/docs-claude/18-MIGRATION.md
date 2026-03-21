# Migration: Claude Code SDK → Agent SDK

## Package Changes

| | Old | New |
|---|-----|-----|
| TypeScript | @anthropic-ai/claude-code | @anthropic-ai/claude-agent-sdk |
| Python | claude-code-sdk | claude-agent-sdk |

## TypeScript Migration

1. `npm uninstall @anthropic-ai/claude-code`
2. `npm install @anthropic-ai/claude-agent-sdk`
3. Update imports: `@anthropic-ai/claude-agent-sdk`
4. No other code changes

## Python Migration

1. `pip uninstall claude-code-sdk`
2. `pip install claude-agent-sdk`
3. `from claude_agent_sdk import query, ClaudeAgentOptions`
4. `ClaudeCodeOptions` → `ClaudeAgentOptions`

## Breaking Changes (v0.1.0)

### System Prompt No Longer Default

Old: Used Claude Code system prompt by default.
New: Minimal prompt. Explicitly request:

```typescript
systemPrompt: { type: "preset", preset: "claude_code" }
```

### Settings Not Loaded by Default

Old: Loaded ~/.claude/settings.json, CLAUDE.md, etc.
New: No settings. Add:

```typescript
settingSources: ["user", "project", "local"]
```

## Documentation

Moved from Claude Code docs to API Guide → Agent SDK section.

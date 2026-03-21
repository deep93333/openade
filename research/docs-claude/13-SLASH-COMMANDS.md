# Slash Commands

Control sessions with commands starting with `/`.

## Discovering Commands

```typescript
if (message.type === "system" && message.subtype === "init") {
  console.log(message.slash_commands);
}
```

## Built-in Commands

### /compact

Reduce conversation history by summarizing. Emits `compact_boundary` with `compact_metadata`.

### /clear

Start fresh conversation. Emits `init` with new session_id.

### /help

Get help.

## Sending Commands

Include in prompt: `prompt: "/compact"`

## Custom Commands

**Legacy**: `.claude/commands/*.md`
**Recommended**: `.claude/skills/*/SKILL.md` (supports /name + autonomous invocation)

### Basic

Create `.claude/commands/refactor.md`:
```markdown
Refactor the selected code to improve readability.
```

### With Frontmatter

```markdown
---
allowed-tools: Read, Grep, Glob
description: Run security scan
model: claude-opus-4-6
---

Analyze for SQL injection, XSS, exposed credentials.
```

### Arguments

`$1`, `$2` in content. `argument-hint: [issue-number] [priority]`

### Bash Output

`!`\`git status\`` - Include command output in prompt.

### File References

`@package.json` - Include file contents.

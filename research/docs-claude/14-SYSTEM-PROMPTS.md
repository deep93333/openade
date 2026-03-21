# Modifying System Prompts

## Default Behavior

SDK uses minimal system prompt. For full Claude Code behavior:

```typescript
systemPrompt: { type: "preset", preset: "claude_code" }
```

```python
system_prompt={"type": "preset", "preset": "claude_code"}
```

## Method 1: CLAUDE.md

Project-level instructions. **Requires** `settingSources: ["project"]`.

Locations: `CLAUDE.md`, `.claude/CLAUDE.md`, `~/.claude/CLAUDE.md`

## Method 2: Output Styles

Saved in `~/.claude/output-styles/` or `.claude/output-styles/`. Loaded via settingSources.

## Method 3: Append to Preset

```typescript
systemPrompt: {
  type: "preset",
  preset: "claude_code",
  append: "Always include docstrings and type hints."
}
```

## Method 4: Custom String

```typescript
systemPrompt: "You are a Python specialist. Write clean code."
```

Replaces default entirely. Must include tool instructions if needed.

## Comparison

| Feature | CLAUDE.md | Output Styles | Append | Custom |
|---------|-----------|---------------|--------|--------|
| Persistence | File | File | Session | Session |
| Default tools | Preserved | Preserved | Preserved | Lost |
| Built-in safety | Yes | Yes | Yes | Must add |

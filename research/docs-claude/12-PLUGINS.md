# Plugins

Load custom plugins (commands, agents, skills, hooks, MCP) from local directories.

## Loading Plugins

```typescript
options: {
  plugins: [
    { type: "local", path: "./my-plugin" },
    { type: "local", path: "/absolute/path/to/plugin" }
  ]
}
```

Path = plugin root (contains `.claude-plugin/plugin.json`).

## Plugin Structure

```
my-plugin/
├── .claude-plugin/
│   └── plugin.json
├── skills/
│   └── my-skill/SKILL.md
├── commands/
├── agents/
├── hooks/
└── .mcp.json
```

## Verifying Load

Check `system` message with `subtype === "init"`:
- `message.plugins`
- `message.slash_commands`

## Plugin Skills

Namespaced: `plugin-name:skill-name`. Invoke: `/my-plugin:greet`

## CLI-installed Plugins

Path: `~/.claude/plugins/`. Pass that path to SDK.

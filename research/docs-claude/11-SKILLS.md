# Agent Skills

Extend Claude with specialized capabilities via SKILL.md files.

## Enabling Skills

1. `setting_sources=["user", "project"]` or `settingSources: ['user', 'project']`
2. `allowed_tools=["Skill"]` or `allowedTools: ["Skill"]`

**Default**: SDK does NOT load filesystem settings. Must set settingSources.

## Skill Locations

- User: `~/.claude/skills/`
- Project: `.claude/skills/`
- Plugin: Bundled with plugins

## Structure

```
.claude/skills/processing-pdfs/
└── SKILL.md
```

SKILL.md has YAML frontmatter + Markdown. `description` determines when Claude invokes.

## allowed-tools in SKILL.md

Only applies to CLI. For SDK, use main `allowedTools` option.

## Discovering Skills

Ask Claude: "What Skills are available?"

## Testing

Ask questions matching Skill descriptions. Claude invokes automatically.

## Troubleshooting

- **Not found**: Check settingSources includes "project" or "user"
- **Not used**: Check "Skill" in allowedTools; improve description specificity

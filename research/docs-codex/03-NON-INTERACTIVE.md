# Non-Interactive Mode (codex exec)

Run Codex from scripts without the interactive TUI.

## When to Use

- CI jobs
- Pipelines
- Scheduled tasks
- Pre-set sandbox and approval settings
- Pipe output to other tools

## Basic Usage

```bash
codex exec "summarize the repository structure and list the top 5 risky areas"
```

Progress streams to stderr; final message to stdout.

## Ephemeral Mode

```bash
codex exec --ephemeral "triage this repository"
```

No session persistence.

## Permissions

- **Default**: Read-only sandbox
- **Allow edits**: `codex exec --full-auto " "`
- **Full access**: `codex exec --sandbox danger-full-access " "` (use only in controlled env)

## JSON Output

```bash
codex exec --json "summarize the repo structure" | jq
```

JSONL stream. Event types: `thread.started`, `turn.started`, `turn.completed`, `turn.failed`, `item.*`, `error`.

## Structured Output

```bash
codex exec "Extract project metadata" \
  --output-schema ./schema.json \
  -o ./project-metadata.json
```

## Authentication

- **CODEX_API_KEY**: Set as secret for CI (only supported in codex exec)
- **codex login**: For ChatGPT-managed auth (advanced)

## Resume

```bash
codex exec "review the change for race conditions"
codex exec resume --last "fix the race conditions you found"
```

Or: `codex exec resume <session-id>`

## Git Requirement

Codex requires Git repo. Override: `codex exec --skip-git-repo-check`

## GitHub Action

Use `openai/codex-action@v1` - see [08-GITHUB-ACTION](08-GITHUB-ACTION.md).

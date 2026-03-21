# GitHub Action

Run Codex in CI workflows.

## Basic Usage

```yaml
- uses: openai/codex-action@v1
  with:
    prompt: "Run tests and fix any failures"
```

## Inputs

| Input | Description |
|-------|-------------|
| prompt | Text prompt for Codex |
| prompt-file | Path to file containing prompt |
| sandbox | workspace-write, read-only, danger-full-access |
| safety-strategy | Approval policy for CI |
| ephemeral | Skip session persistence |

## Authentication

Set `CODEX_API_KEY` as repository secret:

```yaml
env:
  CODEX_API_KEY: ${{ secrets.CODEX_API_KEY }}
```

## Example Workflow

```yaml
name: Codex CI

on:
  push:
    branches: [main]

jobs:
  codex:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: openai/codex-action@v1
        with:
          prompt: "Run tests, fix any failures, and update docs if needed"
          sandbox: workspace-write
        env:
          CODEX_API_KEY: ${{ secrets.CODEX_API_KEY }}
```

## Safety

- Use `sandbox: read-only` for review-only jobs
- Use `safety-strategy` to control auto-approval in CI
- Avoid `danger-full-access` unless necessary

## Repo

https://github.com/openai/codex-action

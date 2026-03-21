# OpenAI Codex SDK - Complete Documentation Index

> Comprehensive documentation for building UI on top of OpenAI Codex
> Source: https://developers.openai.com/codex/sdk
> TypeScript repo: https://github.com/openai/codex/tree/main/sdk/typescript
> Last verified: Mar 2025

## Quick Links

| Document | Description |
|----------|-------------|
| [01-OVERVIEW](01-OVERVIEW.md) | Installation, usage, architecture |
| [02-TYPESCRIPT-SDK](02-TYPESCRIPT-SDK.md) | Codex class, Thread, run(), runStreamed() |
| [03-NON-INTERACTIVE](03-NON-INTERACTIVE.md) | codex exec, CI/CD |
| [04-APP-SERVER](04-APP-SERVER.md) | JSON-RPC protocol, thread/turn APIs |
| [05-SUBAGENTS](05-SUBAGENTS.md) | Parallel agents, workflows |
| [06-SANDBOXING](06-SANDBOXING.md) | Sandbox modes, approval policies |
| [07-CONFIG](07-CONFIG.md) | config.toml, precedence |
| [08-GITHUB-ACTION](08-GITHUB-ACTION.md) | openai/codex-action |
| [09-MODELS](09-MODELS.md) | gpt-5.4, gpt-5.4-mini, reasoning |
| [10-UI-BUILDING-GUIDE](10-UI-BUILDING-GUIDE.md) | Building UI on top of Codex |
| [11-TOOL-CALLS-GUIDE](11-TOOL-CALLS-GUIDE.md) | How tool calls work, agent capabilities, approval |

## Package

- **TypeScript**: `@openai/codex-sdk`
- **CLI**: `@openai/codex` (required - SDK spawns CLI)
- **Repo**: https://github.com/openai/codex

## Key Concepts for UI Building

1. **SDK**: Wraps Codex CLI, exchanges JSONL over stdin/stdout
2. **Thread**: Conversation container; persisted in `~/.codex/sessions`
3. **run()**: Buffers until turn completes; returns finalResponse + items
4. **runStreamed()**: Async generator of events (item.completed, turn.completed)
5. **outputSchema**: Structured JSON output via JSON Schema or Zod
6. **App Server**: JSON-RPC 2.0 for deep integration (thread/start, turn/start, etc.)

## Official Resources

- [Codex SDK](https://developers.openai.com/codex/sdk)
- [TypeScript Repo](https://github.com/openai/codex/tree/main/sdk/typescript)
- [Codex Changelog](https://developers.openai.com/codex/changelog)
- [Codex Action](https://github.com/openai/codex-action)

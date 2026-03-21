# OpenCode SDK - Complete Documentation Index

> Type-safe JS/TS client for the OpenCode server
> Source: https://opencode.ai/docs/sdk/
> Last verified: Mar 2025

## Quick Links

| Document | Description |
|----------|-------------|
| [01-OVERVIEW](01-OVERVIEW.md) | Install, architecture, createOpencode |
| [02-CLIENT-AND-CONFIG](02-CLIENT-AND-CONFIG.md) | createOpencodeClient, config options |
| [03-SESSIONS-API](03-SESSIONS-API.md) | Sessions CRUD, prompt, command, messages |
| [04-FILES-AND-SEARCH](04-FILES-AND-SEARCH.md) | find.text, find.files, file.read |
| [05-STRUCTURED-OUTPUT](05-STRUCTURED-OUTPUT.md) | JSON schema format, retryCount |
| [06-OTHER-APIS](06-OTHER-APIS.md) | Global, App, Project, Path, Config, TUI, Auth, Events |
| [07-TYPES-AND-ERRORS](07-TYPES-AND-ERRORS.md) | TypeScript types, error handling |
| [08-SERVER](08-SERVER.md) | opencode serve, OpenAPI spec |
| [09-UI-BUILDING-GUIDE](09-UI-BUILDING-GUIDE.md) | Building UI on top of OpenCode |
| [10-TOOL-CALLS-GUIDE](10-TOOL-CALLS-GUIDE.md) | How tool calls work, built-in tools, permissions |

## Package

- **npm**: `@opencode-ai/sdk`
- **Server**: `opencode serve` (or `opencode` TUI starts server)
- **Repo**: https://github.com/anomalyco/opencode

## Key Concepts

1. **createOpencode()**: Starts server + client. Use when you control the lifecycle.
2. **createOpencodeClient()**: Client only. Use when server already running.
3. **Sessions**: Conversation containers. Create, prompt, list messages.
4. **Structured Output**: JSON schema for validated model responses.
5. **Events**: SSE stream for real-time updates.

## Official Resources

- [SDK Docs](https://opencode.ai/docs/sdk/)
- [Server Docs](https://opencode.ai/docs/server)
- [Config](https://opencode.ai/docs/config)
- [Ecosystem / Projects](https://opencode.ai/docs/ecosystem#projects)

# Claude Agent SDK - Complete Documentation Index

> Comprehensive documentation for building UI on top of Claude Code Agent SDK
> Source: https://platform.claude.com/docs/en/agent-sdk/overview
> Last verified: Mar 2025

## Quick Links

| Document | Description |
|----------|-------------|
| [01-OVERVIEW](01-OVERVIEW.md) | Installation, setup, first agent |
| [02-BUILT-IN-TOOLS](02-BUILT-IN-TOOLS.md) | Read, Write, Edit, Bash, Glob, Grep, WebSearch, WebFetch |
| [03-HOOKS](03-HOOKS.md) | PreToolUse, PostToolUse, lifecycle hooks |
| [04-SUBAGENTS](04-SUBAGENTS.md) | Specialized agents, Agent tool |
| [05-MCP](05-MCP.md) | Model Context Protocol, external tools |
| [06-PERMISSIONS](06-PERMISSIONS.md) | Permission modes, allow/deny rules |
| [07-SESSIONS](07-SESSIONS.md) | Session management, resume, fork |
| [08-USER-INPUT](08-USER-INPUT.md) | canUseTool, AskUserQuestion |
| [09-STREAMING](09-STREAMING.md) | Streaming vs single message input |
| [10-CUSTOM-TOOLS](10-CUSTOM-TOOLS.md) | createSdkMcpServer, tool() |
| [11-SKILLS](11-SKILLS.md) | Agent Skills, SKILL.md |
| [12-PLUGINS](12-PLUGINS.md) | Plugin loading, local plugins |
| [13-SLASH-COMMANDS](13-SLASH-COMMANDS.md) | /compact, /clear, custom commands |
| [14-SYSTEM-PROMPTS](14-SYSTEM-PROMPTS.md) | CLAUDE.md, presets, custom prompts |
| [15-HOSTING](15-HOSTING.md) | Deployment, containers, patterns |
| [16-SECURE-DEPLOYMENT](16-SECURE-DEPLOYMENT.md) | Sandboxing, isolation |
| [17-COST-TRACKING](17-COST-TRACKING.md) | Token usage, cost tracking |
| [18-MIGRATION](18-MIGRATION.md) | Claude Code SDK → Agent SDK |
| [19-UI-BUILDING-GUIDE](19-UI-BUILDING-GUIDE.md) | Building UI on top of SDK |
| [20-TOOL-CALLS-GUIDE](20-TOOL-CALLS-GUIDE.md) | How tool calls work, built-in tools, approval |

## Package Names

- **TypeScript**: `@anthropic-ai/claude-agent-sdk`
- **Python**: `claude-agent-sdk`

## Key Concepts for UI Building

1. **Streaming**: Use `async for message in query()` - messages stream in real-time
2. **Message Types**: `system`, `assistant`, `result` - filter for UI display
3. **canUseTool**: Required for approval dialogs - surface to user, return allow/deny
4. **AskUserQuestion**: Clarifying questions - display options, collect answers
5. **ClaudeSDKClient** (Python): Session-holding client for multi-turn
6. **continue: true** (TypeScript): Resume most recent session
7. **resume: sessionId**: Resume specific session
8. **ResultMessage**: Contains `result`, `session_id`, `total_cost_usd`

## Official Resources

- [Agent SDK Overview](https://platform.claude.com/docs/en/agent-sdk/overview)
- [Quickstart](https://platform.claude.com/docs/en/agent-sdk/quickstart)
- [TypeScript CHANGELOG](https://github.com/anthropics/claude-agent-sdk-typescript/blob/main/CHANGELOG.md)
- [Python CHANGELOG](https://github.com/anthropics/claude-agent-sdk-python/blob/main/CHANGELOG.md)
- [Example Agents](https://github.com/anthropics/claude-agent-sdk-demos)
- [Report Bugs](https://github.com/anthropics/claude-agent-sdk-typescript/issues) (TS) / [Python](https://github.com/anthropics/claude-agent-sdk-python/issues)

# Subagents

Codex can spawn subagents for parallel work or specialized tasks.

## Manual Triggering

Subagents are triggered manually (e.g. via slash commands or UI), not automatically.

## Use Cases

- **Exploration**: Run multiple agents in parallel to explore different approaches
- **Tests**: Dedicated agent for running tests
- **Triage**: Separate agent for triaging issues

## Models

Subagents use the same model as the parent by default. Can be overridden in config.

## Workflows

- Parent can wait for subagent completion
- Results flow back to parent thread
- Subagent sessions can be resumed independently

## Integration with SDK

When using `thread.run()` or `thread.runStreamed()`, subagent activity appears as items in the turn. No special API for spawning subagents from SDK - they are triggered by the agent's behavior (slash commands, etc.).

## App Server

For App Server integration, subagent threads appear as separate threads. Use `thread/start` with appropriate context to spawn subagent work.

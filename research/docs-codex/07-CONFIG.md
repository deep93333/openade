# Configuration

Codex uses TOML config files and environment variables.

## Config File Locations

1. **Project**: `.codex/config.toml` (repo root)
2. **User**: `~/.codex/config.toml`

Project config overrides user config.

## SDK Override

Pass `config` to `Codex` constructor. Keys are flattened to dotted paths:

```typescript
new Codex({
  config: {
    show_raw_agent_reasoning: true,
    sandbox_workspace_write: { network_access: true },
    model: "gpt-5.4-mini"
  }
});
```

## Common Options

| Option | Description |
|--------|-------------|
| model | gpt-5.4, gpt-5.4-mini, gpt-5.3-codex, gpt-5.3-codex-spark |
| show_raw_agent_reasoning | Show reasoning traces |
| sandbox_workspace_write | Sandbox config (network_access, etc.) |
| sandbox_read_only | Read-only mode |
| sandbox_danger_full_access | Disable sandbox |
| approval_policy | on-request, never, untrusted |
| openai_base_url | Custom API base URL |

## Environment Variables

| Variable | Description |
|----------|-------------|
| CODEX_API_KEY | Codex API key (preferred for codex exec) |
| OPENAI_API_KEY | OpenAI API key (fallback) |

## Precedence

1. SDK `config` option (highest)
2. Project `.codex/config.toml`
3. User `~/.codex/config.toml`
4. Environment variables

## baseUrl

For custom endpoints:

```typescript
new Codex({ baseUrl: "https://custom.openai.com/v1" });
```

Or in config:

```toml
openai_base_url = "https://custom.openai.com/v1"
```

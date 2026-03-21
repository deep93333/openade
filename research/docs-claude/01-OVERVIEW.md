# Claude Agent SDK - Overview

## What It Is

The Claude Agent SDK (formerly Claude Code SDK) gives you the same tools, agent loop, and context management that power Claude Code, programmable in Python and TypeScript.

**Key difference from Client SDK**: You don't implement the tool loop. Claude handles it autonomously.

## Installation

### TypeScript
```bash
npm install @anthropic-ai/claude-agent-sdk
```

### Python (uv)
```bash
uv init && uv add claude-agent-sdk
```

### Python (pip)
```bash
python3 -m venv .venv && source .venv/bin/activate
pip3 install claude-agent-sdk
```

## API Key

```bash
export ANTHROPIC_API_KEY=your-api-key
```

Or create `.env`:
```
ANTHROPIC_API_KEY=your-api-key
```

**Third-party providers**:
- Amazon Bedrock: `CLAUDE_CODE_USE_BEDROCK=1` — [setup guide](https://code.claude.com/docs/en/amazon-bedrock)
- Google Vertex AI: `CLAUDE_CODE_USE_VERTEX=1` — [setup guide](https://code.claude.com/docs/en/google-vertex-ai)
- Microsoft Azure: `CLAUDE_CODE_USE_FOUNDRY=1` — [setup guide](https://code.claude.com/docs/en/azure-ai-foundry)

**Note**: Anthropic does not allow third-party developers to offer claude.ai login. Use API key authentication.

**Project config** (Skills, Commands, CLAUDE.md, Plugins): Set `settingSources: ["project"]` (TS) or `setting_sources: ["project"]` (Python) to load from `.claude/`.

## Minimal Example

### TypeScript
```typescript
import { query } from "@anthropic-ai/claude-agent-sdk";

for await (const message of query({
  prompt: "What files are in this directory?",
  options: { allowedTools: ["Bash", "Glob"] }
})) {
  if ("result" in message) console.log(message.result);
}
```

### Python
```python
import asyncio
from claude_agent_sdk import query, ClaudeAgentOptions

async def main():
    async for message in query(
        prompt="What files are in this directory?",
        options=ClaudeAgentOptions(allowed_tools=["Bash", "Glob"]),
    ):
        if hasattr(message, "result"):
            print(message.result)

asyncio.run(main())
```

## Agent SDK vs Client SDK

| Client SDK | Agent SDK |
|------------|-----------|
| You implement tool loop | Claude handles tools autonomously |
| `response.stop_reason === "tool_use"` → your executor | `async for message in query()` |
| Manual tool execution | Built-in Read, Edit, Bash, etc. |

## Agent SDK vs Claude Code CLI

| Use Case | Best Choice |
|----------|-------------|
| Interactive development | CLI |
| CI/CD pipelines | SDK |
| Custom applications | SDK |
| One-off tasks | CLI |
| Production automation | SDK |

## Prerequisites

- Anthropic account
- Node.js 18+ or Python 3.10+

## Branding Guidelines

**Allowed**: "Claude Agent", "Claude", "{YourAgentName} Powered by Claude"
**Not permitted**: "Claude Code", "Claude Code Agent", Claude Code ASCII art

## License

[Anthropic's Commercial Terms of Service](https://www.anthropic.com/legal/commercial-terms)

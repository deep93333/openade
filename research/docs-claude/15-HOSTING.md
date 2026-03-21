# Hosting

Deploy Claude Agent SDK in production.

## Architecture

SDK maintains conversational state and executes commands in persistent environment. Unlike stateless LLM APIs.

## Requirements

- Container-based sandboxing
- Outbound HTTPS to api.anthropic.com
- Python 3.10+ or Node.js 18+
- Claude Code CLI: `npm install -g @anthropic-ai/claude-code`
- Recommended: 1GiB RAM, 5GiB disk, 1 CPU

## Sandbox Providers

- Vercel Sandbox
- Fly Machines
- E2B
- Daytona
- Cloudflare Sandboxes
- Modal Sandbox

## Deployment Patterns

### 1. Ephemeral Sessions

New container per task. Destroy when complete. Best for: bug fix, translation, invoice processing.

### 2. Long-Running Sessions

Persistent containers. Multiple agent processes. Best for: chat bots, site builders, email agents.

### 3. Hybrid Sessions

Ephemeral + hydrated with history. Best for: support, research, project manager.

### 4. Single Containers

Multiple agents in one container. Best for: simulations.

## FAQ

- **Communication**: Expose HTTP/WebSocket endpoints
- **Cost**: ~5 cents/hour minimum for containers; tokens dominate
- **Idle timeout**: Provider-dependent
- **Session timeout**: No built-in; set maxTurns to prevent loops
- **Monitoring**: Standard backend logging

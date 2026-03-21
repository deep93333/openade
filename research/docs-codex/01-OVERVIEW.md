# Codex SDK - Overview

## What It Is

The Codex SDK lets you control Codex programmatically. Use it when you need to:

- Integrate Codex within your own application
- Build Codex into internal tools and workflows
- Create agents that engage with Codex for complex engineering tasks
- Control Codex as part of CI/CD pipelines

## Architecture

The TypeScript SDK **wraps the `codex` CLI** from `@openai/codex`. It spawns the CLI and exchanges JSONL events over stdin/stdout.

**Server-side only** - requires Node.js 18+.

## Installation

```bash
npm install @openai/codex-sdk
```

The Codex CLI (`@openai/codex`) must also be installed - the SDK spawns it.

## Minimal Example

```typescript
import { Codex } from "@openai/codex-sdk";

const codex = new Codex();
const thread = codex.startThread();
const turn = await thread.run("Make a plan to diagnose and fix the CI failures");

console.log(turn.finalResponse);
console.log(turn.items);
```

## Multi-Turn

Call `run()` repeatedly on the same `Thread` to continue the conversation:

```typescript
const nextTurn = await thread.run("Implement the plan");
```

## Resuming Threads

Threads persist in `~/.codex/sessions`. Reconstruct with `resumeThread()`:

```typescript
const thread = codex.resumeThread(savedThreadId);
await thread.run("Pick up where you left off");
```

## Automation Options

| Option | Use Case |
|--------|----------|
| **Codex SDK** | Programmatic control, CI/CD, custom apps |
| **codex exec** | Scripts, pipelines, non-interactive |
| **App Server** | Deep integration (auth, history, approvals) |
| **GitHub Action** | Run Codex in CI workflows |

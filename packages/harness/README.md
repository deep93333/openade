# @agentide/harness

Vendor-neutral TypeScript types for bridging **Claude Agent SDK**, **Codex SDK**, and **OpenCode** into AgentIDE. See [`research/comparison.md`](../../research/comparison.md) for the design reference (research still uses older names like `UnifiedSession`; this package uses the vocabulary below).

## `SCHEMA_VERSION`

Bump when `Pulse` or other public unions change in a breaking way.

## Vocabulary

| Type / value | Role |
|--------------|------|
| `Runtime` | Which SDK runs the loop (`claude` \| `codex` \| `opencode`). |
| `Profile` | Credentials and options for one runtime. |
| `Suite` | All runtime profiles plus `defaultRuntime`. |
| `Session` | A conversation container (`runtime`, `metadata`, native ids). |
| `Pulse` | Streamed wire events (text deltas, tools, approvals, completion). |
| `Turn` | One completed model response (`Segment[]`). |
| `Segment` | A slice of a turn: text, tool_call, or error. |
| `Driver` | Implements the runtime (`promptStreamed` yields `Pulse`; `getCapabilities` returns `Traits`). |
| `Traits` | What this `Driver` supports. |
| `ToolKey` | Canonical tool id; `TOOL_ALIASES` maps to each vendor’s name. |
| `Verdict` | Allow/deny (+ optional input edit) for tool approval. |
| `ApprovalReply` | Structural stand-in for IPC `ToolApprovalResponse` (no `@agentide/shared` import). |

## `Runtime` vs `AgentProvider`

- **`Runtime`**: SDK that executes the agent.
- **`AgentProvider`** (in `@agentide/shared`): product keys / model UI (e.g. minimax, moonshot).

## Approvals

- `verdictFromReply` — IPC-shaped `ApprovalReply` → `Verdict`
- `replyFromVerdict` — `Verdict` → `ApprovalReply`

## `Pulse` → `AgentMessage`

`Pulse` is the **driver → host** stream. `AgentMessage` stays the UI transcript; a later reducer maps pulses into IPC messages.

## Consumers

- **`@agentide/agent`**: future `Driver` implementations.
- **`apps/desktop`**: optional IPC typing.

## Build

```bash
bun run --filter @agentide/harness build
```

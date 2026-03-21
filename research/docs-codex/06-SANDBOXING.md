# Sandboxing and Safety

Codex runs agent actions in a sandbox to limit impact on the host.

## Sandbox Modes

| Mode | Description |
|------|-------------|
| **workspace-write** | Default. Can read/write workspace, limited network. |
| **read-only** | No writes. Use for review, triage. |
| **danger-full-access** | No sandbox. Use only in controlled environments. |

## Setting Mode

**CLI**:
```bash
codex exec --sandbox read-only "review this PR"
codex exec --sandbox danger-full-access " "  # Full access
```

**Config** (`config.toml`):
```toml
[sandbox]
workspace_write = { network_access = true }
# or
read_only = true
# or
danger_full_access = true
```

**SDK**:
```typescript
const codex = new Codex({
  config: {
    sandbox_workspace_write: { network_access: true },
    // or sandbox_read_only: true,
    // or sandbox_danger_full_access: true
  }
});
```

## Approval Policy

Controls when Codex asks for user approval before running commands:

| Policy | Behavior |
|--------|----------|
| **on-request** | Default. Ask when agent wants to run commands. |
| **never** | Never ask. Auto-approve (use with caution). |
| **untrusted** | Ask for untrusted/sensitive operations. |

## Approval in SDK

When using `thread.run()`, approval prompts are handled by the CLI. For headless/CI, use `--full-auto` or `approval_policy: "never"` in config.

## Approval in App Server

App Server supports approval flows - client receives notifications and can send approval/rejection via RPC.

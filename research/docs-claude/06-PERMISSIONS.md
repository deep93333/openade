# Permissions

Control how your agent uses tools.

## Permission Evaluation Order

1. **Hooks** - Can allow, deny, or continue
2. **Deny rules** - disallowed_tools, settings.json
3. **Permission mode** - bypassPermissions, acceptEdits, etc.
4. **Allow rules** - allowed_tools, settings.json
5. **canUseTool callback** - Runtime decision (skipped in dontAsk)

## Permission Modes

| Mode | Description |
|------|-------------|
| default | No auto-approvals; unmatched → canUseTool |
| dontAsk | (TS only) Deny anything not in allowedTools |
| acceptEdits | Auto-approve file edits, mkdir, rm, mv, cp |
| bypassPermissions | All tools run without prompts |
| plan | No tool execution; planning only |

## Allow and Deny Rules

```typescript
allowedTools: ["Read", "Grep"],
disallowedTools: ["Bash"]
```

- `allowed_tools`: Pre-approve listed tools
- `disallowed_tools`: Always deny (even in bypassPermissions)

**Locked-down agent**: `allowedTools` + `permissionMode: "dontAsk"`

## Set Permission Mode

### At Query Time

```typescript
options: { permissionMode: "acceptEdits" }
```

### During Streaming

```typescript
await q.setPermissionMode("acceptEdits");
```

## acceptEdits Mode

Auto-approves: Edit, Write, mkdir, touch, rm, mv, cp. Other tools (e.g. Bash) still need approval.

## dontAsk Mode (TypeScript Only)

Converts prompts to denials. Python: use `disallowed_tools` to block.

## bypassPermissions

Use with extreme caution. Full system access. Deny rules and hooks still apply.

## plan Mode

No tool execution. Claude plans only. AskUserQuestion still works for clarification.

## Subagent Inheritance

With bypassPermissions, subagents inherit and cannot override.

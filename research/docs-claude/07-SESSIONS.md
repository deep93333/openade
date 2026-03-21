# Sessions

Persist conversation history across queries.

## Choose an Approach

| What you're building | Use |
|----------------------|-----|
| One-shot task | Nothing extra |
| Multi-turn in one process | ClaudeSDKClient (Python) or continue: true (TS) |
| Resume after restart | continue_conversation: true / continue: true |
| Resume specific session | resume: sessionId |
| Try alternative approach | fork_session: true |
| Stateless (TS only) | persistSession: false |

## Continue vs Resume vs Fork

- **Continue**: Finds most recent session in cwd. No ID needed.
- **Resume**: Takes specific session ID. For multi-user or specific session.
- **Fork**: New session with copy of history. Original unchanged.

## Python: ClaudeSDKClient

```python
async with ClaudeSDKClient(options=options) as client:
    await client.query("Analyze the auth module")
    async for message in client.receive_response():
        print_response(message)
    await client.query("Now refactor it to use JWT")
    async for message in client.receive_response():
        print_response(message)
```

## TypeScript: continue: true

```typescript
// First query
for await (const message of query({ prompt: "Analyze auth", options })) { ... }

// Second query - resumes most recent
for await (const message of query({
  prompt: "Now refactor to JWT",
  options: { continue: true, ... }
})) { ... }
```

## Capture Session ID

From `ResultMessage` or `SDKResultMessage`:

```typescript
if (message.type === "result") sessionId = message.session_id;
```

```python
if isinstance(message, ResultMessage): session_id = message.session_id
```

## Resume by ID

```typescript
options: { resume: sessionId }
```

```python
ClaudeAgentOptions(resume=session_id)
```

## Fork

```typescript
options: { resume: sessionId, forkSession: true }
```

```python
ClaudeAgentOptions(resume=session_id, fork_session=True)
```

Fork creates new session; capture its session_id from result.

## Session Storage

Sessions: `~/.claude/projects/{cwd-hash}/*.jsonl`

`cwd` must match for resume to find session. Sessions are local to machine.

## Resume Across Hosts

1. Don't rely on resume - pass results as prompt context
2. Or: Copy session file to same path on new host; cwd must match

## listSessions / getSessionMessages

Both SDKs expose these for custom session pickers and cleanup.

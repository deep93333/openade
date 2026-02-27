# Checkpoint System

Checkpoints let users rewind a conversation thread — and optionally the workspace code — to the state before any specific message was sent.

A checkpoint is created automatically before every agent run. Restoring one undoes the agent's conversation output and/or file changes, scoped to exactly what that run touched.

---

## Data Model

```ts
type Checkpoint = {
  id: string;
  threadId: string;
  messageIndex: number;        // index in thread.messages where the user message will land
  timestamp: number;
  gitStashRef?: string;        // git stash create ref capturing dirty tracked files before the run
  untrackedAtCheckpoint?: string[]; // untracked files that existed before the run
  modifiedFiles?: string[];    // tracked files the agent modified (set after run completes)
  createdFiles?: string[];     // new files the agent created (set after run completes)
};
```

Checkpoints are stored on `ChatThread.checkpoints` and persisted with the thread in chat storage.

---

## Lifecycle

### 1. Create — before every agent run

Triggered by `startAgent` → `createCheckpoint` → `IPC.CHECKPOINT_CREATE`.

```
User sends message
       │
       ▼
createCheckpoint(workspaceId)
  ├─ git stash create          → gitStashRef   (null if working tree is clean)
  ├─ git ls-files --others     → untrackedAtCheckpoint
  │
  ├─ Sequential finalization of previous checkpoint (if unfinalized):
  │    git diff --name-only <prevStashRef> <newStashRef>  → prev.modifiedFiles
  │    newUntracked - prevUntracked                       → prev.createdFiles
  │
  └─ New checkpoint stored on thread
       │
       ▼
User message added to thread → agent starts
```

The previous checkpoint's `modifiedFiles` is computed **at this moment** using consecutive stash refs — not against the current working tree — so it captures exactly what that prior agent run changed, independent of any other concurrent thread activity.

### 2. Finalize — after every agent run completes

Triggered by `setResult` → `api.checkpoint.finalize` → `IPC.CHECKPOINT_FINALIZE`.

This handles only the **most recent** (last) checkpoint in the thread, since no next checkpoint exists yet:

```
Agent run completes
       │
       ▼
CHECKPOINT_FINALIZE(workspaceId, threadId)
  ├─ Find last checkpoint without modifiedFiles
  ├─ git diff --name-only <stashRef or HEAD>  → modifiedFiles
  ├─ git ls-files --others minus untrackedAtCheckpoint → createdFiles
  └─ Update checkpoint in storage + store
```

### 3. Restore — when user clicks rewind

User hovers a user message bubble → clicks the rotate icon → picks a restore mode.

```
CHECKPOINT_RESTORE(workspaceId, stashRef, modifiedFiles?, createdFiles?)
       │
       ├─ modifiedFiles known (checkpoint finalized):
       │    git checkout <stashRef or HEAD> -- <modifiedFiles>   ← targeted, thread-scoped
       │    delete <createdFiles> from disk
       │
       ├─ modifiedFiles empty, stashRef present:
       │    git checkout <stashRef> -- .                         ← full working tree restore
       │
       └─ stashRef null (was clean):
            git checkout HEAD -- .                               ← undo agent changes to HEAD
```

Then, depending on the restore mode:

| Mode | Code | Conversation |
|---|---|---|
| Restore code & conversation | ✓ (code first) | ✓ (only if code succeeds) |
| Restore conversation only | — | ✓ |
| Restore code only | ✓ | — |

Conversation restore truncates `thread.messages` to `slice(0, checkpoint.messageIndex)`, removing the user message and all subsequent agent messages.

---

## Multi-thread safety

Each thread's `modifiedFiles` is computed from **consecutive checkpoint stash refs within that thread**:

```
Thread A: checkpoint A1 ──agent── checkpoint A2 ──agent── checkpoint A3
                     ↑                        ↑
          A1.modifiedFiles =       A2.modifiedFiles =
          diff(A1.stashRef,        diff(A2.stashRef,
               A2.stashRef)             A3.stashRef)

Thread B: checkpoint B1 ──agent── checkpoint B2
                     ↑
          B1.modifiedFiles =
          diff(B1.stashRef, B2.stashRef)
```

Restoring Thread A's checkpoint only checks out `A1.modifiedFiles` — Thread B's files are never touched.

If two threads modified the **same file**, restoring one thread's checkpoint will overwrite the shared file to its state at that checkpoint. This is expected: the user explicitly chose to restore, and there is no way to resolve a shared-file conflict without branches.

---

## Git operations reference

| Operation | Git command | When |
|---|---|---|
| Snapshot working tree | `git stash create` | Checkpoint creation |
| List untracked files | `git ls-files --others --exclude-standard` | Checkpoint creation + finalization |
| Diff two snapshots | `git diff --name-only <refA> <refB>` | Sequential finalization |
| Diff snapshot to current | `git diff --name-only <ref>` | Last-checkpoint finalization |
| Restore specific files | `git checkout <ref> -- file1 file2 ...` | Targeted restore |
| Restore all tracked files | `git checkout <ref> -- .` | Full working tree restore |
| Restore to last commit | `git checkout HEAD -- .` | Restore when snapshot was clean |

### Why `git stash create` instead of `git stash push`

`git stash create` returns a commit hash of the working tree state **without modifying the stash list or touching the working tree**. It is silent and non-destructive. `git stash push` would modify the stash list and require cleanup. The returned refs are regular git commit objects and will be garbage-collected by git when unreachable (roughly 2 weeks by default, or on `git gc`).

---

## Key files

| File | Responsibility |
|---|---|
| `packages/shared/src/types.ts` | `Checkpoint` and `ChatThread` types |
| `packages/shared/src/ipc-channels.ts` | `CHECKPOINT_CREATE`, `CHECKPOINT_FINALIZE`, `CHECKPOINT_RESTORE` channel names |
| `packages/shared/src/electron-api.ts` | `ElectronAPI.checkpoint` type declarations |
| `apps/desktop/src/services/git-service.ts` | All git operations: stash, diff, restore, delete |
| `apps/desktop/src/ipc.ts` | IPC handlers for create, finalize, restore |
| `apps/desktop/src/preload.ts` | Electron preload bridge |
| `apps/app/src/store/agent.store.ts` | `createCheckpoint`, `rewindToCheckpoint`, finalize in `setResult` |
| `apps/app/src/components/agent/message-bubble.tsx` | Rewind button UI on user message bubbles |

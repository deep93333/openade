# Checkpoint System

Checkpoints let users rewind a conversation thread — and optionally the workspace code — to the state before any specific message was sent.

A checkpoint is created automatically before every agent run. Restoring one undoes the agent's conversation output and/or file changes, scoped to exactly what that run touched.

---

## Data Model

```ts
type FileSnapshot = {
  filePath: string;
  beforeContent: string | null;  // null for files that didn't exist
  existed: boolean;
};

type Checkpoint = {
  id: string;
  threadId: string;
  messageIndex: number;        // index in thread.messages where the user message will land
  timestamp: number;
  baseHead?: string;           // HEAD commit SHA at checkpoint creation
  gitStashRef?: string;        // git stash create ref (legacy fallback)
  untrackedAtCheckpoint?: string[];
  modifiedFiles?: string[];    // tracked files the agent modified (set after run completes)
  createdFiles?: string[];     // new files the agent created (set after run completes)
  fileSnapshots?: FileSnapshot[]; // per-file before-content captured at mutation time
  snapshotStorePath?: string;     // disk path where full snapshots are persisted
};
```

Checkpoints are stored on `ChatThread.checkpoints` and persisted with the thread in chat storage.

---

## Restore Strategy: Shadow Copy (Primary) + Git (Fallback)

### Shadow Copy (primary — most reliable)

Each file-modifying tool (`write`, `edit`, `delete`) captures the file's content **immediately before mutating it** via a `onFileSnapshot` callback in the tool context. This gives exact, race-free before-snapshots regardless of git state.

Snapshots are:
1. Accumulated per-session in the IPC layer during the agent run
2. Persisted to `<userData>/agentide/snapshots/<workspaceId>/<threadId>/<checkpointId>/` at finalization
3. Used for restore by writing back each file's `beforeContent`, or deleting files that didn't exist

**Why this is more reliable than git-based restore:**
- Captures truth at mutation time — no timing/race issues
- Works in non-git repos, clean trees, and complex `.gitignore` scenarios
- Handles all file operations uniformly (write, edit, delete, create)
- Deterministic restore: just write bytes back, no git commands involved

### Git stash (fallback)

If no snapshots are available (e.g., old checkpoints created before this feature), the system falls back to the original git-based restore using `git stash create` refs and `git checkout`.

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
       │
       ▼
Tools run: write/edit/delete each call onFileSnapshot(before, existed)
  └─ Snapshots accumulated in sessionFileSnapshots map (keyed by workspace:thread)
```

### 2. Finalize — after every agent run completes

Triggered by `setResult` → `api.checkpoint.finalize` → `IPC.CHECKPOINT_FINALIZE`.

```
Agent run completes
       │
       ▼
CHECKPOINT_FINALIZE(workspaceId, threadId)
  ├─ Find last checkpoint without modifiedFiles
  ├─ git diff --name-only <stashRef or HEAD>  → modifiedFiles
  ├─ git ls-files --others minus untrackedAtCheckpoint → createdFiles
  ├─ Collect accumulated file snapshots from session map
  ├─ Save snapshots to disk via snapshotStore.saveSnapshots()
  │    → <userData>/agentide/snapshots/<wsId>/<threadId>/<cpId>/
  │       ├─ manifest.json
  │       └─ <sanitized_filename>.snapshot  (one per file)
  └─ Update checkpoint with snapshotStorePath + modifiedFiles/createdFiles
```

### 3. Restore — when user clicks rewind

User hovers a user message bubble → clicks the rotate icon → picks a restore mode.

```
rewindToCheckpoint(workspaceId, checkpointId, mode)
       │
       ├─ If checkpoint has snapshotStorePath (preferred):
       │    api.checkpoint.restoreSnapshots(wsId, threadId, cpId)
       │      ├─ loadSnapshots() → read manifest + .snapshot files
       │      └─ restoreFromSnapshots()
       │           ├─ existed=true:  write beforeContent back to filePath
       │           └─ existed=false: delete filePath (agent-created file)
       │
       ├─ Else fallback to git-based restore:
       │    api.checkpoint.restore(wsId, stashRef, modifiedFiles, createdFiles)
       │      ├─ modifiedFiles known: git checkout <ref> -- <files> + delete createdFiles
       │      ├─ stashRef present:    git checkout <stashRef> -- .
       │      └─ stashRef null:       git checkout HEAD -- .
       │
       └─ Then conversation restore (if applicable):
            truncate thread.messages to checkpoint.messageIndex
```

Restore modes:

| Mode | Code | Conversation |
|---|---|---|
| Restore code & conversation | ✓ (code first) | ✓ (only if code succeeds) |
| Restore conversation only | — | ✓ |
| Restore code only | ✓ | — |

---

## Snapshot Garbage Collection

Old snapshots are automatically cleaned up to prevent unbounded disk growth.

### Triggers

| When | Action |
|---|---|
| App startup | `runGarbageCollection()` fire-and-forget |
| Thread deletion | `deleteThreadSnapshots(workspaceId, threadId)` |

### Retention policy

| Rule | Default | Rationale |
|---|---|---|
| Max age | 14 days | Nobody rewinds a 2-week-old chat |
| Max total disk | 500 MB | Hard cap safety net |
| Thread delete | Immediate | No reason to keep data for deleted threads |

### GC algorithm

1. Walk `<userData>/agentide/snapshots/` tree
2. Delete any checkpoint directory with `manifest.json` mtime older than `maxAgeMs`
3. If remaining total size exceeds `maxTotalBytes`, delete oldest first until under budget
4. Runs asynchronously, never blocks the user

---

## Multi-thread safety

Each thread's snapshots are isolated by directory path: `<wsId>/<threadId>/<cpId>/`. Restoring one thread's checkpoint only touches files that thread's agent run modified.

If two threads modified the **same file**, restoring one thread's checkpoint will overwrite the shared file to its state before that thread's run. This is expected behavior.

---

## Git operations reference (fallback)

| Operation | Git command | When |
|---|---|---|
| Snapshot working tree | `git stash create` | Checkpoint creation |
| List untracked files | `git ls-files --others --exclude-standard` | Checkpoint creation + finalization |
| Diff two snapshots | `git diff --name-only <refA> <refB>` | Sequential finalization |
| Diff snapshot to current | `git diff --name-only <ref>` | Last-checkpoint finalization |
| Restore specific files | `git checkout <ref> -- file1 file2 ...` | Targeted restore (fallback) |
| Restore all tracked files | `git checkout <ref> -- .` | Full working tree restore (fallback) |
| Restore to last commit | `git checkout HEAD -- .` | Restore when snapshot was clean (fallback) |

### Why `git stash create` instead of `git stash push`

`git stash create` returns a commit hash of the working tree state **without modifying the stash list or touching the working tree**. It is silent and non-destructive. The returned refs are regular git commit objects and will be garbage-collected by git when unreachable.

---

## Key files

| File | Responsibility |
|---|---|
| `packages/shared/src/types.ts` | `FileSnapshot`, `Checkpoint`, and `ChatThread` types |
| `packages/shared/src/ipc-channels.ts` | `CHECKPOINT_*` channel names including `SAVE_SNAPSHOTS`, `RESTORE_SNAPSHOTS` |
| `packages/shared/src/electron-api.ts` | `ElectronAPI.checkpoint` type declarations |
| `packages/agent/src/tools/tool-types.ts` | `FileSnapshotEntry` type, `ToolContext.onFileSnapshot` callback |
| `packages/agent/src/tools/write.ts` | Captures before-content before writing |
| `packages/agent/src/tools/edit.ts` | Captures before-content before editing |
| `packages/agent/src/tools/delete.ts` | Captures before-content before deleting |
| `packages/agent/src/custom-agent-backend.ts` | Wires `onFileSnapshot` from options into tool context |
| `packages/agent/src/agent-manager.ts` | Passes `onFileSnapshot` through to backend |
| `apps/desktop/src/services/snapshot-store.ts` | Disk persistence: save, load, restore, delete, GC |
| `apps/desktop/src/services/git-service.ts` | Git operations: stash, diff, restore (fallback) |
| `apps/desktop/src/ipc.ts` | IPC handlers: accumulates snapshots per-session, saves on finalize |
| `apps/desktop/src/preload.ts` | Electron preload bridge |
| `apps/app/src/store/agent.store.ts` | `createCheckpoint`, `rewindToCheckpoint` (tries snapshots first) |
| `apps/app/src/utils/checkpoint.ts` | Helper utilities for checkpoint UI |
| `apps/app/src/components/agent/message-bubble.tsx` | Rewind button UI on user message bubbles |

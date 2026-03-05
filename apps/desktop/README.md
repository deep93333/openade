# @agentide/desktop

Electron main process for AgentIDE. Manages windows, IPC communication between renderer and backend services, and all system-level operations (git, filesystem, terminal, authentication).

## Architecture

```
src/
├── main.ts              # Electron app entry — window creation, IPC registration, menu setup
├── menu.ts              # Application menu (File, Edit, View, Window, Help)
├── preload.ts           # Context bridge — exposes electronAPI to the renderer
├── preload-log.ts       # Context bridge for the log viewer window
├── ipc/                 # IPC handlers (main → renderer communication)
│   ├── index.ts         # Registers all IPC handler groups
│   ├── agent.ts         # Agent start/stop/status, tool approval flow
│   ├── auth.ts          # API key management, Claude CLI login, auth methods
│   ├── chat.ts          # Chat load/save/delete per workspace
│   ├── checkpoint.ts    # Git-based checkpoint create/finalize/restore
│   ├── filesystem.ts    # Directory tree, file reading, skills, editor launch, logs
│   ├── git.ts           # Branch operations, staging, commits, push, diffs, project init/clone
│   ├── terminal.ts      # PTY terminal create/write/resize/destroy
│   └── workspace.ts     # Workspace CRUD, selection, file/git watchers
└── services/            # Backend logic (no Electron IPC awareness)
    ├── agent.ts          # Session pool setup — connects @agentide/agent to desktop config
    ├── chat.ts           # Chat thread persistence (JSON on disk, legacy migration)
    ├── config.ts         # App config and encrypted API key storage via safeStorage
    ├── editor.ts         # Open files in external editors (VS Code, Cursor, Vim, etc.)
    ├── filesystem.ts     # Directory tree traversal with skip-list filtering
    ├── git.ts            # Git operations via simple-git (branches, diffs, stash, checkpoints)
    ├── git.test.ts       # Tests for git stash/checkpoint operations
    ├── logging.ts        # Agent log writer (file + console)
    ├── logwindow.ts      # Log viewer BrowserWindow with auto-refresh HTML
    ├── skills.ts         # Load agent skills from ~/.cursor/skills and ~/.claude/skills
    ├── terminal.ts       # PTY process pool (node-pty spawn/write/resize/destroy)
    ├── watcher.ts        # File system + git index watchers with debounced change events
    ├── windows.ts        # Main app BrowserWindow creation and management
    └── workspace.ts      # Workspace CRUD with disk persistence and git info refresh
```

## Data Flow

```
Renderer (preload.ts)
    ↕ ipcRenderer.invoke / ipcRenderer.on
IPC Handlers (ipc/*.ts)
    ↕ function calls
Services (services/*.ts)
    ↕ fs / simple-git / node-pty / electron APIs
System
```

## Key Concepts

**IPC pattern**: Every IPC handler returns `{ success: true, data? }` or `{ success: false, error }`. Channel names come from `@agentide/shared` (`IPC` constants).

**Checkpoints**: Git stash-based snapshots tied to chat thread messages. Created before agent runs, finalized after, restored on demand. Stash refs stored under `refs/checkpoints/<threadId>/`.

**Workspace events**: File system changes and git index changes emit debounced IPC events to the renderer so the UI stays in sync.

**Authentication**: Supports two methods — Claude CLI login (`claude auth status`) and direct API key entry. Keys encrypted via Electron `safeStorage`.

## Scripts

| Command | Description |
|---|---|
| `bun run dev` | Build + run Electron in dev mode (connects to localhost:3010) |
| `bun run dev:static` | Build + run using static app bundle |
| `bun run build` | Build main process with tsup |
| `bun run package` | Full production build + electron-builder |
| `bun run test` | Run vitest |

## Dependencies

| Package | Purpose |
|---|---|
| `@agentide/agent` | Agent runner, session pool, tools |
| `@agentide/shared` | Shared types and IPC channel constants |
| `simple-git` | Git operations |
| `node-pty` | Terminal emulation |
| `fix-path` | Fix $PATH in packaged macOS apps |
| `ulid` | Sortable unique IDs |

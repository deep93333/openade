# AgentIDE

An open-source, agent-first IDE for running Claude Code in isolated workspaces. Send prompts, stream agent output in real time, and manage multiple project directories from one window.

Inspired by [Conductor](https://conductor.build).

## Features

- **Workspaces** — Add project directories and switch between them. Each workspace is the agent’s working directory.
- **Claude Code integration** — Uses the [Claude Code TypeScript SDK](https://docs.anthropic.com/en/docs/claude-code/sdk) to run agents programmatically from the main process.
- **Streaming output** — Assistant messages, tool use (Read, Edit, Bash, etc.), and partial tokens stream live into the chat.
- **Stop / abort** — Cancel a running agent at any time.
- **Dark UI** — Sidebar + chat layout with Tailwind v4.

## Where session data lives

AgentIDE keeps its own files out of the repo by default (tools still read and write normal project files as part of coding tasks).

**Agent server** (`bun run dev:server`, web workflow) — default root `~/.agentide-server/` (override with `AGENTIDE_DATA_DIR`):

- Threads (model JSONL): `…/threads/<workspace-id>/`
- Large tool-output spill files: `…/context/<workspace-id>/`
- Checkpoint file snapshots: `…/snapshots/<workspace-id>/<thread-id>/<checkpoint-id>/`
- Stash for untracked files during checkpoint restore: `…/checkpoint-trash/<workspace-path-hash>/`

**Electron app** — under the app user data directory (e.g. `~/Library/Application Support/<app>/agentide/` on macOS):

- Same idea: `agentide/snapshots/…`, `agentide/checkpoint-trash/…`, plus existing `agentide/chats/` and `config.json`.

Chat UI state on the server remains `chats/<workspace-id>.json` next to the paths above.

To store thread JSONL and tool spill files **inside** the project again (legacy layout: `.agentide/threads`, `.agentide/context`), set `AGENTIDE_THREADS_IN_WORKSPACE=1`. Old JSONL under the project is still read when no file exists in the new location yet.

**Not on disk in the project:** the read tool’s duplicate-read warnings use an in-memory map for that run only. **Outside AgentIDE:** MCP servers, language tooling, and build tools may still create normal caches in the repo (e.g. `node_modules/.cache`, `.turbo`); those are unrelated to AgentIDE’s own storage.

## Prerequisites

- [Git](https://git-scm.com)
- [Bun](https://bun.sh) (optional if you use the one-liner below — it can install Bun for you)
- [Claude Code](https://docs.anthropic.com/en/docs/claude-code) installed and authenticated (CLI or API key)
- Node.js 18+ (for contributors using npm in some scripts)

## One command

From any directory (requires Git; installs [Bun](https://bun.sh) if it is missing).

**tryade.sh** (landing + install scripts, Vite app in `apps/tryade`): `curl -fsSL https://tryade.sh/i | bash` — same installer, easy to share. Develop: `bun run dev:tryade`; build: `bun run build:tryade`. Deploy `apps/tryade/dist` to your host and point the domain at it. For a preview host, build with `TRYADE_ORIGIN=https://your-preview.vercel.app bun run build:tryade` so `/i` fetches `/install.sh` from that origin.

**GitHub raw** (bootstrap → full `scripts/install.sh` on `main`):

```bash
curl -fsSL https://raw.githubusercontent.com/deep93333/agentide/main/i | bash
```

Same behavior, canonical script path:

```bash
curl -fsSL https://raw.githubusercontent.com/deep93333/agentide/main/scripts/install.sh | bash
```

This clones into `./agentide`, runs `bun install`, then `bun run dev`. Use another folder: add `my-agentide` at the end of the `bash` line (arguments pass through). For a fork:

```bash
export AGENTIDE_REPO=https://github.com/you/agentide.git
curl -fsSL https://raw.githubusercontent.com/deep93333/agentide/main/i | bash
```

### Even shorter to share

- **After you publish `@agentide/cli`:** `npx @agentide/cli` — no install URL at all.
- **Link shortener:** point any short link (Bitly, `is.gd`, your own domain) at `https://raw.githubusercontent.com/deep93333/agentide/main/i` so people run `curl -fsSL https://your.short/i | bash`.
- **Custom script URL:** `AGENTIDE_INSTALL_SCRIPT_URL=https://…/install.sh curl -fsSL https://…/i | bash` (forks or mirrors).

(`export` must run in the same shell session before the `curl` line so the piped `bash` inherits it.)

If you already cloned the repo:

```bash
./scripts/install.sh .
```

(`cd` into the clone first so `.` resolves to that directory.)

## Install via npm

After `@agentide/cli` is published:

```bash
npx @agentide/cli
```

Global install:

```bash
npm install -g @agentide/cli
agentide
```

Maintainers: from the repo root, `npm run publish:cli` (npm login with access to the `@agentide` scope).

## Quick Start

```bash
# Clone and enter the repo
cd agentide

# Install dependencies
bun install

# Build shared types (required before app/desktop)
bun run build:shared

# Run the app (Vite dev server + Electron)
bun run dev
```

Electron will open and load the React UI from `http://localhost:3010`. Add a workspace (name + directory path), select it, then type a prompt and send to start the agent.

## Scripts

| Script | Description |
|--------|-------------|
| `bun run dev` | Start Vite (app) and Electron (desktop) together |
| `bun run dev:tryade` | Landing + install scripts for tryade.sh (port 3020) |
| `bun run build:tryade` | Production build → `apps/tryade/dist` |
| `bun run dev:app` | Vite dev server only (port 3010) |
| `bun run dev:desktop` | Build desktop and run Electron (expects app on 3010) |
| `bun run build` | Build shared → app → desktop |
| `bun run build:shared` | Build `packages/shared` |
| `bun run build:app` | Build React app (Vite) |
| `bun run build:desktop` | Build Electron main + preload (tsup) |
| `bun run format` | Format with Biome |
| `bun run clean` | Remove `dist` / build artifacts |

## Project Structure

```
agentide/
├── package.json          # Workspace root, scripts, deps
├── biome.json            # Formatter (2 spaces, double quotes, semicolons)
├── tsconfig.base.json    # Shared TS config
├── packages/
│   └── shared/           # Types and IPC contract
│       └── src/
│           ├── types.ts        # AgentMessage, Workspace, IpcResult, etc.
│           ├── ipc-channels.ts # IPC channel constants
│           ├── electron-api.ts # ElectronAPI type for preload
│           └── index.ts
├── apps/
│   ├── tryade/           # tryade.sh landing + static /i and /install.sh (Vite)
│   ├── app/              # React renderer (Vite 7)
│   │   ├── src/
│   │   │   ├── main.tsx, app.tsx
│   │   │   ├── layouts/        # App layout (sidebar + main)
│   │   │   ├── components/     # sidebar/, agent/ (chat, messages)
│   │   │   ├── store/          # Zustand: agent, workspace
│   │   │   └── lib/            # electron API, cn()
│   │   ├── vite.config.ts
│   │   └── tailwind.css
│   └── desktop/         # Electron main process (tsup)
│       ├── src/
│       │   ├── main.ts         # App entry, window creation
│       │   ├── preload.ts      # contextBridge → window.electronAPI
│       │   ├── ipc.ts          # ipcMain handlers
│       │   ├── windows/        # app-window.ts
│       │   └── services/       # agent-manager, workspace-manager
│       └── tsup.config.ts
└── README.md
```

## Tech Stack

- **Runtime**: Electron 37, React 18, TypeScript 5.8
- **Build**: Vite 7 (app), tsup (desktop), Bun
- **State**: Zustand 5
- **UI**: Tailwind CSS v4, Radix UI where used
- **Agent**: `@anthropic-ai/claude-agent-sdk`
- **Format**: Biome

## Build Order

For a full build, run in order:

1. `bun run build:shared`
2. `bun run build:app`
3. `bun run build:desktop`

Or use `bun run build` (runs all three).

## Roadmap

- Git worktree support for isolated branches per workspace
- Diff viewer for agent changes
- Multiple concurrent agents
- Settings (model, API key path, etc.)
- Packaged builds (e.g. electron-builder)

## License

MIT

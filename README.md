# Openade

An open-source, agent-first IDE for running Claude Code in isolated workspaces. Send prompts, stream agent output in real time, and manage multiple project directories from one window.

Inspired by [Conductor](https://conductor.build).

## Features

- **Workspaces** — Add project directories and switch between them. Each workspace is the agent’s working directory.
- **Claude Code integration** — Uses the [Claude Code TypeScript SDK](https://docs.anthropic.com/en/docs/claude-code/sdk) to run agents programmatically from the main process.
- **Streaming output** — Assistant messages, tool use (Read, Edit, Bash, etc.), and partial tokens stream live into the chat.
- **Stop / abort** — Cancel a running agent at any time.
- **Dark UI** — Sidebar + chat layout with Tailwind v4.

## Where session data lives

Openade keeps its own files out of the repo by default (tools still read and write normal project files as part of coding tasks).

**Agent server** (`bun run dev:server`, web workflow) — default root `~/.openade-server/` (override with `OPENADE_DATA_DIR`; `AGENTIDE_DATA_DIR` still works):

- Threads (model JSONL): `…/threads/<workspace-id>/`
- Large tool-output spill files: `…/context/<workspace-id>/`
- Checkpoint file snapshots: `…/snapshots/<workspace-id>/<thread-id>/<checkpoint-id>/`
- Stash for untracked files during checkpoint restore: `…/checkpoint-trash/<workspace-path-hash>/`

**Electron app** — under the app user data directory (e.g. `~/Library/Application Support/<app>/openade/` on macOS):

- Same idea: `openade/snapshots/…`, `openade/checkpoint-trash/…`, plus existing `openade/chats/` and `config.json`.

Chat UI state on the server remains `chats/<workspace-id>.json` next to the paths above.

To store thread JSONL and tool spill files **inside** the project again (layout: `.openade/threads`, `.openade/context`), set `OPENADE_THREADS_IN_WORKSPACE=1` (or `AGENTIDE_THREADS_IN_WORKSPACE=1`). JSONL previously under `.agentide/threads` is still read when no file exists in the new location yet.

**Not on disk in the project:** the read tool’s duplicate-read warnings use an in-memory map for that run only. **Outside Openade:** MCP servers, language tooling, and build tools may still create normal caches in the repo (e.g. `node_modules/.cache`, `.turbo`); those are unrelated to Openade’s own storage.

## Prerequisites

- [Git](https://git-scm.com)
- [Bun](https://bun.sh) (optional if you use the one-liner below — it can install Bun for you)
- [Claude Code](https://docs.anthropic.com/en/docs/claude-code) installed and authenticated (CLI or API key)
- **Node.js 20.19+** (22 LTS recommended) if `node` is on your PATH — Vite 7 needs it; the install script checks this after cloning

## Static web UI + local agent server

You can deploy the Vite app (`apps/app`) as **static files** (e.g. tryade.dev or any CDN) and run **`bun run dev:server`** (or full `bun run dev`) on your Mac. The local agent server uses a **fixed default port `42891`** (same idea as Ollama’s default `11434` — predictable, not `PORT`). Override with **`OPENADE_AGENT_PORT`** or legacy **`AGENT_SERVER_PORT`** only if needed; the generic **`PORT`** env var is **not** read for this server. The browser UI calls **`VITE_AGENT_SERVER_URL`** when set at build time; otherwise it defaults to **`http://127.0.0.1:42891`** (see `@openade/shared` `OPENADE_AGENT_DEFAULT_*`).

The agent server sends CORS headers for local Vite ports, **https://tryade.dev**, and **https://www.tryade.dev**. To allow another origin (e.g. your preview URL), start the server with:

```bash
OPENADE_CORS_ORIGINS=https://your-app.pages.dev bun run dev:server
```

(`AGENTIDE_CORS_ORIGINS` is accepted as a legacy alias.) Use HTTPS page → `http://127.0.0.1:…` only in browsers that allow it (most allow localhost); if WebSockets fail, try the UI on `http://localhost` for local testing.

## One command (CLI)

Requires Git, **Node.js 20+** on your PATH, and a published **`tryade`** CLI on npm (or run the bin from a clone — see below). Install docs and shell fallback live at [tryade.dev](https://tryade.dev). The unscoped name `openade` is blocked by npm as too similar to `openai`; the short name `ade` is often unavailable.

```bash
npx --yes tryade
```

Clones into `./openade`, installs [Bun](https://bun.sh) if needed, runs `bun install` quietly, then starts **`bun run dev` in the background** (logs in `~/.openade/dev-server.log`, PID in `~/.openade/dev-server.pid`). In a normal terminal it opens **[prompts](https://github.com/terkelg/prompts)** for folder name and background vs foreground unless you pass flags. **`--yes` / `-y`** skips prompts (also the default when stdin is not a TTY or `CI` is set). Foreground: `--foreground`. Verbose git/install: `--verbose`. Pass folder on the command line to skip that prompt: `npx --yes tryade my-folder`. Fork: `export OPENADE_REPO=https://github.com/you/openade.git` (or legacy `AGENTIDE_REPO`) then run `npx` again.

Global install:

```bash
npm install -g tryade
tryade
```

(The `openade` command is also installed as an alias.)

**From this repo without publishing:** `node packages/cli/bin/openade.cjs`

Maintainers: `npm run publish:cli` (publishes the `tryade` package from `packages/cli`).

## Shell installer (no npm)

If you prefer bash or do not have `npx`:

```bash
curl -fsSL https://tryade.dev/install.sh | bash
```

**tryade.dev** also serves `curl …/i | bash`, which runs `npx --yes tryade` when `npx` exists, otherwise downloads `install.sh`. Landing site lives in `apps/tryade` — `bun run dev:tryade` / `bun run build:tryade`. Preview builds: `TRYADE_ORIGIN=https://your-preview.vercel.app bun run build:tryade`.

**GitHub raw** (same shell script on `main`):

```bash
curl -fsSL https://raw.githubusercontent.com/deep93333/openade/main/scripts/install.sh | bash
```

If you already cloned the repo:

```bash
./scripts/install.sh .
```

## Quick Start

```bash
# Clone and enter the repo
cd openade

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
| `bun run dev:tryade` | Landing + install scripts for tryade.dev (port 3020) |
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
openade/
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
│   ├── tryade/           # tryade.dev landing + static /i and /install.sh (Vite)
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

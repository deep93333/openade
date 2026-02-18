# AgentIDE

An open-source, agent-first IDE for running Claude Code in isolated workspaces. Send prompts, stream agent output in real time, and manage multiple project directories from one window.

Inspired by [Conductor](https://conductor.build).

## Features

- **Workspaces** — Add project directories and switch between them. Each workspace is the agent’s working directory.
- **Claude Code integration** — Uses the [Claude Code TypeScript SDK](https://docs.anthropic.com/en/docs/claude-code/sdk) to run agents programmatically from the main process.
- **Streaming output** — Assistant messages, tool use (Read, Edit, Bash, etc.), and partial tokens stream live into the chat.
- **Stop / abort** — Cancel a running agent at any time.
- **Dark UI** — Sidebar + chat layout with Tailwind v4.

## Prerequisites

- [Bun](https://bun.sh) (or npm)
- [Claude Code](https://docs.anthropic.com/en/docs/claude-code) installed and authenticated (CLI or API key)
- Node.js 18+

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

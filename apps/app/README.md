# @agentide/app

React frontend for AgentIDE. Provides the chat UI, file tree, terminal, git changes panel, and all user-facing features. Runs inside Electron (via `@agentide/desktop`) or standalone via Vite dev server.

## Architecture

```
src/
├── main.tsx                 # React root — mounts <App />
├── app.tsx                  # Root component — renders AppLayout
├── design-system.css        # Design tokens (colors, fonts, spacing)
├── tailwind.css             # Tailwind entry
├── styles/index.css         # Global styles
│
├── store/                   # Zustand stores (global state)
│   ├── agent.ts             # Agent sessions, threads, messages, streaming, tool approvals, checkpoints
│   ├── editor.ts            # Chat prompt, image attachments, model selection
│   ├── workspace.ts         # Workspace CRUD, active workspace, git branches
│   ├── ui.ts                # UI state (panels, views, dialogs, center page)
│   ├── filetree.ts          # File tree nodes, expand/collapse, lazy loading
│   ├── context.ts           # File/element context injection into chat
│   ├── terminal.ts          # Terminal sessions, layout, visibility
│   └── cost.ts              # Token cost tracking with localStorage persistence
│
├── lib/                     # Core utilities
│   ├── electron.ts          # Electron API bridge (getElectronAPI, isElectron)
│   ├── cn.ts                # Tailwind class name merger (clsx + tailwind-merge)
│   ├── diffs.ts             # Registers custom diff viewer themes
│   ├── highlighter.ts       # Shiki syntax highlighter (lazy init, lang detection)
│   └── themes/              # Shiki/diffs JSON theme files
│
├── utils/                   # Pure utility functions
│   ├── message.ts           # HTML → plain text normalizer for user messages (mentions, file context)
│   ├── images.ts            # Image attachment validation, file→dataUrl conversion
│   ├── patch.ts             # Unified diff patch builder
│   └── checkpoint.ts        # Checkpoint lookup helpers
│
├── hooks/                   # React hooks
│   ├── use-agent-skills.ts  # Load and filter agent skills
│   ├── use-git-changes.ts   # Poll git staged/unstaged changes
│   ├── use-skill-hint.ts    # Match user prompt to relevant skills
│   ├── use-thread-changed-files.ts  # Track files changed per thread
│   └── use-workspace-files.ts       # Watch workspace file changes
│
├── layouts/                 # Page-level layouts
│   └── app-layout/
│       ├── index.tsx        # Main layout — sidebar + center + secondary pane + right panel
│       ├── constants.ts     # Panel size constraints
│       ├── right-panel.tsx  # Git changes / file tree panel
│       ├── secondary-pane-panel.tsx  # File viewer / diff viewer
│       └── use-app-layout.ts        # Layout state management
│
└── components/              # UI components
    ├── agent/               # Chat & agent UI
    │   ├── agent-panel.tsx          # Main chat panel (messages + editor)
    │   ├── message-list.tsx         # Scrollable message list
    │   ├── message-bubble.tsx       # Single message (user/assistant/system)
    │   ├── markdown-message.tsx     # Markdown renderer with code blocks
    │   ├── tool-approval-bar.tsx    # Tool execution approval UI
    │   ├── file-mention-list.tsx    # @ file mention suggestions
    │   ├── image-attachment-preview.tsx  # Image preview thumbnails
    │   ├── json-message-viewer.tsx  # Raw JSON message inspector
    │   ├── chat-editor/             # Rich text chat input
    │   │   ├── chat-editor.tsx      # TipTap editor with mentions, images, model selector
    │   │   ├── editor-area.tsx      # Editor content area
    │   │   ├── embedded-toolbar.tsx # Send button, model picker, attachments
    │   │   ├── changed-files-bar.tsx # Changed files indicator
    │   │   ├── mode-selector.tsx    # Agent/Plan/Ask mode toggle
    │   │   └── token-usage-popover.tsx  # Token usage breakdown
    │   └── tools/                   # Tool result renderers
    │       ├── tool-registry.ts     # Maps tool names to components
    │       ├── tool-call-group.tsx  # Groups consecutive tool calls
    │       ├── tool-container.tsx   # Collapsible tool result wrapper
    │       ├── inline-tool-row.tsx  # Compact single-line tool display
    │       ├── bash-tool.tsx        # Terminal output renderer
    │       ├── diff-tool.tsx        # Diff viewer for file changes
    │       ├── file-tool.tsx        # File read/write result
    │       ├── text-editor-tool.tsx # Edit tool result with diff
    │       ├── search-tool.tsx      # Grep/glob results
    │       ├── lints-tool.tsx       # Lint error display
    │       ├── ask-question-tool.tsx # Structured question UI
    │       ├── todo-write.tsx       # Task list display
    │       └── generic-tool.tsx     # Fallback renderer
    │
    ├── sidebar/             # Left sidebar
    │   ├── index.tsx                # Sidebar root (workspace list, navigation)
    │   ├── workspace-item.tsx       # Single workspace entry
    │   ├── workspace-item-header.tsx # Workspace name, branch, actions
    │   ├── workspace-thread-list.tsx # Thread list within workspace
    │   ├── workspace-thread-row.tsx  # Single thread entry
    │   ├── branch-switcher.tsx      # Git branch selector
    │   ├── create-workspace-dialog.tsx  # New workspace dialog
    │   ├── create-branch-dialog.tsx     # New git branch dialog
    │   ├── remove-workspace-dialog.tsx  # Delete workspace confirmation
    │   └── delete-thread-dialog.tsx     # Delete thread confirmation
    │
    ├── file-tree/           # File explorer
    │   ├── file-tree.tsx    # Tree view with expand/collapse
    │   ├── file-tree-item.tsx # Single file/folder row
    │   └── file-icons.tsx   # File type → icon mapping
    │
    ├── file-viewer/         # Source file viewer
    │   └── file-viewer.tsx  # Syntax-highlighted file display
    │
    ├── web-view/            # Embedded browser
    │   ├── web-view-drawer.tsx     # Browser panel with URL bar
    │   ├── element-info-panel.tsx  # DOM element inspector
    │   └── inspector-script.ts    # Injected element picker script
    │
    ├── tasks/               # Task management
    │   └── tasks-page.tsx   # Task list UI
    │
    ├── agent-skills/        # Skills browser
    │   └── agent-skills.tsx # Skills list and detail view
    │
    ├── primitives/          # Shared micro-components
    │   ├── diff-stats.tsx   # +N / -N change stats
    │   └── file-name.tsx    # File name with icon
    │
    ├── shared/              # Shared domain components
    │   ├── task-status-badge.tsx    # Status indicator
    │   └── task-status-selector.tsx # Status dropdown
    │
    ├── app-top-bar.tsx      # Top navigation bar
    ├── command-palette.tsx   # Cmd+K command palette
    ├── api-key-dialog.tsx   # API key configuration dialog
    ├── cost-display.tsx     # Token cost indicator
    ├── diff-viewer.tsx      # Side-by-side diff component
    ├── git-changes-panel.tsx # Staged/unstaged file changes
    ├── provider-key-input.tsx # Provider-specific API key input
    ├── terminal-panel.tsx   # xterm.js terminal emulator
    └── agent-log-drawer.tsx # Agent execution log viewer
```

## State Management

All state lives in Zustand stores under `store/`. Components subscribe to slices they need.

| Store | Key Responsibilities |
|---|---|
| `agent.ts` | Agent sessions, chat threads, message streaming, tool approvals, checkpoints, thread CRUD |
| `editor.ts` | Chat prompt text, image attachments, model options, provider selection |
| `workspace.ts` | Workspace list, active workspace, git branch info, workspace CRUD |
| `ui.ts` | Panel visibility, secondary pane (file/diff), center page routing, web view, dialogs |
| `filetree.ts` | File tree nodes, lazy directory expansion, collapse state |
| `context.ts` | Handlers for injecting file snippets and DOM elements into chat |
| `terminal.ts` | Terminal session pool, active session, layout mode |
| `cost.ts` | Cumulative token cost with localStorage persistence |

## Navigation

No router — navigation is state-driven via `useUIStore.centerPage`:
- `"chat"` → Agent chat panel (default)
- `"skills"` → Agent skills browser
- `"tasks"` → Task management page

## Key Patterns

**Electron bridge**: All Electron IPC calls go through `lib/electron.ts` → `getElectronAPI()`. Returns `null` when running outside Electron, enabling graceful degradation.

**Tool renderers**: Each agent tool has a dedicated React component in `components/agent/tools/`. The `tool-registry.ts` maps tool names to components. Adding a new tool renderer is just adding a component and registering it.

**Lazy highlighting**: Shiki highlighter in `lib/highlighter.ts` initializes once on first use, loading only the languages needed. Theme files are loaded via dynamic import.

## Scripts

| Command | Description |
|---|---|
| `bun run dev` | Vite dev server on port 3010 |
| `bun run build` | Production build |
| `bun run build:electron` | Build for Electron embedding |
| `bun run test` | Run vitest |
| `bun run preview` | Preview production build |

## Dependencies

| Package | Purpose |
|---|---|
| `react` / `react-dom` | UI framework |
| `zustand` | State management |
| `@tiptap/*` | Rich text editor (chat input) |
| `shiki` | Syntax highlighting |
| `@pierre/diffs` | Diff viewer component |
| `@xterm/xterm` | Terminal emulator |
| `react-resizable-panels` | Resizable panel layout |
| `react-markdown` / `remark-gfm` | Markdown rendering |
| `@radix-ui/*` | Accessible UI primitives (dialogs, tooltips, menus) |
| `@tabler/icons-react` | Icon set |
| `tailwindcss` / `tailwind-merge` | Styling |
| `@agentide/shared` | Shared types and IPC constants |
| `@agentide/ui` | Shared UI components |

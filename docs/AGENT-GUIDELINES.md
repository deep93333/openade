# AgentIDE — Sub-Agent Guidelines

**Audience:** Any AI agent (Cursor, Claude, Codex, or another) working on this codebase.

**Rule:** Act as a senior engineer. Do not work around problems — fix them at the root. If a pattern is wrong, say so and fix the pattern, not just the symptom.

---

## 1. Project structure — know where things live

```
agentide/
├── packages/
│   ├── shared/src/          ← Types, IPC channels, ElectronAPI contract
│   │   ├── types.ts         ← ALL shared types (AgentMessage, AgentStartParams, etc.)
│   │   ├── electron-api.ts  ← ElectronAPI type (what renderer can call)
│   │   └── ipc-channels.ts  ← IPC channel name constants
│   └── ui/                  ← Shared UI components (Button, Drawer, etc.)
├── apps/
│   ├── app/src/             ← Renderer (React + Vite)
│   │   ├── components/      ← UI components (agent/, sidebar/, file-tree/, etc.)
│   │   ├── store/           ← Zustand stores (agent.store, workspace.store, ui.store)
│   │   ├── hooks/           ← React hooks
│   │   ├── utils/           ← Pure utility functions
│   │   └── lib/             ← Non-React libs (electron.ts, shiki, themes)
│   └── desktop/src/         ← Main process (Electron)
│       ├── services/        ← Backend services (agent-manager, git-service, chat-storage, etc.)
│       ├── ipc.ts           ← IPC handler registration
│       ├── preload.ts       ← Preload script (exposes electronAPI to renderer)
│       └── main.ts          ← Electron main entry
└── docs/                    ← All documentation
```

**Before writing any code, confirm you know which layer you're in.** Don't put renderer logic in desktop or vice versa. Don't import from `apps/desktop` in `apps/app` or the other way.

---

## 2. Type rules — strict, no workarounds

### Use `type` not `interface`

This project uses `type` exclusively. Do not introduce `interface`. No exceptions.

```ts
// correct
type UserConfig = { model: string; provider: AgentProvider };

// wrong — do not use interface
interface UserConfig { model: string; provider: AgentProvider; }
```

### All shared types live in `packages/shared/src/types.ts`

If a type is used across renderer and main (or across packages), it goes in `packages/shared/src/types.ts` and is exported from the package. Do not redefine the same shape in multiple files. Do not use `unknown` or `any` to avoid importing the correct type.

### No inline type casts to work around mismatches

If a type doesn't match, fix the type at the source. Do not cast with `as`. If you find yourself writing `(api.workspace as { someMethod: ... }).someMethod`, the real fix is to update `ElectronAPI` in shared and `preload.ts` to declare that method correctly.

### No comments in code

Do not add comments that describe what the code does. No "// Import the module", no "// Handle error", no "// Start the agent". The code should be self-documenting. Only add comments for non-obvious constraints, edge cases, or trade-offs that the code itself cannot convey.

---

## 3. IPC and process boundary — the contract

### Single source of truth

The contract between renderer and main is defined in three files:

1. `packages/shared/src/ipc-channels.ts` — Channel name constants.
2. `packages/shared/src/electron-api.ts` — `ElectronAPI` type (method signatures, params, returns).
3. `packages/shared/src/types.ts` — All param and return types.

**Rule:** `preload.ts` must match `ElectronAPI` exactly. `ipc.ts` must handle all channels declared in `ipc-channels.ts`. If you add a new IPC call:

1. Add the channel to `ipc-channels.ts`.
2. Add the method signature to `ElectronAPI` in `electron-api.ts` (with proper param/return types from `types.ts`).
3. Implement the handler in `ipc.ts`.
4. Expose the method in `preload.ts` (importing shared types for params).
5. Call it in the renderer via `getElectronAPI()`.

**Never** add an IPC call in `ipc.ts` or `preload.ts` without updating all three contract files.

### Access Electron API correctly

In the renderer, always use `getElectronAPI()` from `@/lib/electron`. Never access `window.electronAPI` directly. Never redeclare `window` types in components.

```ts
// correct
const api = getElectronAPI();
if (!api) return;
const result = await api.workspace.list();

// wrong
const api = window.electronAPI;
// wrong
declare const window: Window & { electronAPI?: { ... } };
```

---

## 4. Agent backend — provider abstraction

### The contract

Every agent provider implements `AgentBackend` from `apps/desktop/src/services/agent-backend-types.ts`. Read `docs/agent-backend.md` before touching anything in the agent layer.

Key rules:

- **All providers emit the same event shapes** (`AgentMessage`, `AgentResult`, error payload, provider session id). No provider-specific types leak to the renderer.
- **Capabilities are declared, not assumed.** If a provider doesn't support a feature (e.g. image attachments, plan mode), declare it in `capabilities`. The UI gates features by capabilities — do not add provider-specific `if` checks in UI components.
- **Models come from the backend.** Do not hardcode model lists in the renderer. Each `AgentBackend` declares its `models: ModelOption[]`.
- **Resume is provider-scoped.** `ChatThread.sdkSessionId` is the provider's session id. `ChatThread.provider` tracks which provider created it. If the user switches provider, `resumeSessionId` is cleared — do not pass a Claude session id to Codex.

### Adding a new provider

1. Extend `AgentProvider` in `packages/shared/src/types.ts`.
2. Create `apps/desktop/src/services/<provider>-agent-backend.ts` implementing `AgentBackend`.
3. Register in the router (`agent-manager.ts`).
4. No IPC, preload, or renderer changes needed.

---

## 5. State management — Zustand stores

### Store boundaries

| Store | Owns | Does NOT own |
|-------|------|-------------|
| `agent.store` | Thread state, runtime (status/streaming/error), session mapping, tool approval, checkpoints | Workspace data, UI state |
| `workspace.store` | Workspace list, active workspace, git info, file/git change versions | Agent state, UI state |
| `ui.store` | Panel visibility, active view, file viewer state, web view state, dialogs | Business data |

**Do not mix concerns.** Agent store should not set UI state. Workspace store should not know about threads. If you need cross-store coordination, do it in the component or a hook — not by importing one store inside another.

### Store patterns

- **Async actions:** Set loading → call IPC → on success: update state; on failure: set error. Always handle both paths.
- **Error state:** Stores should have an error field for async operations. Do not silently swallow failures with `catch {}` or bare returns.
- **No side effects inside `set()`.** Zustand `set()` calls should be pure state updates. If you need a side effect (e.g. persist to disk, call IPC), do it before or after the `set()` call, not inside.

---

## 6. Component patterns

### File organization

- One component per file. Named export matching the file name.
- Component directories: `component-name/index.ts` re-exports; `types.ts` for component-specific types; split sub-components into separate files.
- Hooks that serve a single component go in the component directory. Shared hooks go in `hooks/`.

### Do not duplicate code

Before writing a utility (path manipulation, string formatting, file type detection), check if it already exists:

- `utils/` — Pure functions.
- `lib/` — Non-React libraries and wrappers.
- `components/file-tree/file-icons.tsx` — File type icons.
- `components/shared/` — Shared UI pieces.

If you find duplicated logic (e.g. `dirname`/`basename` defined in multiple components), consolidate it into `utils/` and update all call sites.

### No dead code

Do not leave unused components, imports, or files. If something is replaced (e.g. a standalone file superseded by a directory module), delete the old file. Check before creating: does a version of this already exist?

---

## 7. Formatting and style

### Biome (not ESLint, not Prettier)

This project uses **Biome** for formatting. Config: `biome.json` at root.

- Indent: 2 spaces
- Quotes: double
- Semicolons: always
- Trailing commas: ES5
- Line width: 100
- Arrow parens: always

**Do not** add ESLint, Prettier, or other formatters. Do not add format-on-save configs that conflict with Biome. If you're unsure, run `bun run format:check` and `bun run format --write .`.

### TypeScript

- Target: ES2022, strict mode, bundler module resolution.
- Path alias: `@/` maps to `src/` in the app.
- `type` keyword for type-only imports: use `import type { ... }` when importing only types.

### Naming

- Files: `kebab-case.ts` / `kebab-case.tsx`.
- Types: `PascalCase`.
- Variables, functions, hooks: `camelCase`.
- Constants: `UPPER_SNAKE_CASE` for true constants (IPC channels, storage keys). Regular `camelCase` for config objects.

---

## 8. Git and commits

### Conventional commits

All commit messages must use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add codex agent backend
fix: resolve mention content not sent to agent
refactor: extract claude backend from agent-manager
docs: add agent-backend abstraction guide
chore: update biome config
```

Keep messages short (one line, < 72 chars). No emoji. No period at the end.

### What to commit

- Commit working code. Do not commit half-finished features with TODO placeholders.
- Commit related changes together. One logical change per commit.
- Do not commit generated files, build artifacts, `.env`, or API keys.

---

## 9. Testing

### Test files

- Co-located with the code they test: `agent.store.state.test.ts` next to `agent.store.ts`.
- Use Vitest (`describe`, `it`, `expect`, `vi.fn()`, `vi.mock()`).
- Config: `vitest.config.ts` per app.

### Mocking Electron API

When testing renderer code that calls `getElectronAPI()`, mock the module:

```ts
vi.mock("@/lib/electron", () => ({
  getElectronAPI: vi.fn(() => ({
    chat: { load: vi.fn(), save: vi.fn() },
    agent: { start: vi.fn(), stop: vi.fn(), onMessage: vi.fn(() => () => {}) },
  })),
}));
```

Provide only the methods the test actually uses. Type the mock to match `ElectronAPI`.

### What to test

- **Stores:** State transitions (add message, set result, switch thread, error handling). These are the most important tests.
- **Utils:** Pure functions (prompt builder, path helpers, normalization).
- **Desktop services:** Git operations, chat storage, agent backend event mapping.
- **Do not** write tests for simple component rendering unless there's complex logic. Do not write tests that just assert a component renders without errors.

---

## 10. Documentation

### All docs live in `docs/`

| Doc | What |
|-----|------|
| `foundation.md` | Step-by-step plan to correct the foundation |
| `CODEBASE-REFACTOR.md` | Full list of gaps, abstractions, refactors |
| `agent-backend.md` | Agent backend contract, provider mapping |
| `AGENT-GUIDELINES.md` | This file: rules for sub-agents |
| `claude-agent-sdk-guide.md` | Claude Agent SDK reference |
| `codex-agent-guide.md` | Codex SDK/MCP reference |
| `checkpoint.md` | Checkpoint/rewind system |

### When to update docs

- **New IPC call:** Update `docs/electron-api.md` (when it exists) or note in the relevant doc.
- **New agent provider:** Update `docs/agent-backend.md`.
- **Changed architecture:** Update `docs/foundation.md` and `docs/CODEBASE-REFACTOR.md`.

---

## 11. What NOT to do — hard rules

1. **Do not work around type mismatches.** Fix the type at the source. No `as unknown as X`. No `// @ts-ignore`.
2. **Do not add comments to explain obvious code.** No "// start the agent", no "// handle error". If you add a comment, it must explain *why*, not *what*.
3. **Do not use `interface`.** Use `type`.
4. **Do not access `window.electronAPI` directly.** Use `getElectronAPI()`.
5. **Do not hardcode provider-specific logic in the renderer.** Use capabilities and the backend contract.
6. **Do not add new dependencies without checking if the project already has an equivalent.** e.g. don't add `lodash` for `debounce` when a 3-line util works.
7. **Do not leave dead code.** If you replace something, delete the old version.
8. **Do not create new files unless necessary.** Prefer editing existing files. Do not create README files or documentation unless explicitly asked.
9. **Do not commit with generic messages.** Use conventional commits. "fix stuff" or "update code" is not acceptable.
10. **Do not swallow errors silently.** Every `catch` block should either set error state, log meaningfully, or re-throw. Empty `catch {}` is a bug.

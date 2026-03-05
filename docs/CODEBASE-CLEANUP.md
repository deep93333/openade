# AgentIDE Codebase: Documentation & Cleanup Roadmap

Single reference for **codebase structure**, **existing docs**, and **cleanup tasks** to reach a clean, maintainable codebase.

Related: [CODEBASE-REFACTOR.md](./CODEBASE-REFACTOR.md) (technical debt, abstractions), [foundation.md](./foundation.md) (fix order).

---

## 1. Codebase overview

### Root

- **Monorepo**: Bun workspaces; `workspaces: ["packages/*", "apps/*"]` in root `package.json`.
- **Root files**: `package.json`, `README.md`, `biome.json`, `tsconfig.base.json`, `.gitignore`, `bun.lock`, `STATE_MANAGEMENT_REFACTOR.md`, `scripts/build-electron-app.sh`.
- **Directories**: `apps/`, `packages/`, `docs/`, `scripts/`, `.cursor/`.

### apps/

| App | Role | Entry / config |
|-----|------|----------------|
| **app** | React renderer (Vite 7) | `src/main.tsx`, `src/app.tsx`, `vite.config.ts`, `vitest.config.ts` |
| **desktop** | Electron main + preload | `src/main.ts`, `src/preload.ts`, `src/ipc.ts`, `tsup.config.ts`, `electron-builder.*.yml`, `vitest.config.ts` |
| **cli** | CLI app | `apps/cli` |

**app** layout: `layouts/`, `components/` (agent/, sidebar/, file-tree/, tasks/, shared/, etc.), `store/` (Zustand), `hooks/`, `utils/`, `lib/`, `types/`.

**desktop** layout: `services/` (agent-manager, git-service, config-storage, workspace-manager, terminal-service, etc.), `windows/`, `ipc.ts`, `menu.ts`.

### packages/

| Package | Role | Key files |
|---------|------|-----------|
| **shared** | Types + IPC contract | `src/types.ts`, `src/electron-api.ts`, `src/ipc-channels.ts`, `src/index.ts` |
| **agent** | Agent backend + tools | `src/agent-manager.ts`, `src/custom-agent-backend.ts`, `src/system-prompt.ts`, `src/tools/` (read, write, edit, bash, grep, glob, ls, todowrite, delete, readlints, ask-question), `src/tools/registry.ts` |
| **ui** | Shared UI components | `index.ts`, `theme.css`, `src/components/`, `src/icons/`, `src/examples/`, `src/lib/`, `src/styles/` |

**Build order**: `build:shared` → `build:agent` → `build:app` (electron) → `build:desktop`.

---

## 2. Existing documentation

### Documented

- **README.md**: Quick start, scripts, project structure, tech stack, build order, roadmap. Structure was outdated; see below for current layout.
- **docs/AGENT-GUIDELINES.md**: For AI agents: structure, type rules (`type` not `interface`), shared types in `packages/shared`, IPC contract, no comments, testing.
- **docs/CODEBASE-REFACTOR.md**: Technical debt, missing abstractions, refactor ideas, doc index, priorities (P0–P3).
- **docs/foundation.md**: Step-by-step foundation fixes: contract (shared + preload), agent backend, prompt builder, optional cleanups.
- **docs/agent-backend.md**: Backend contract, capabilities, Claude/Codex mapping.
- **docs/checkpoint.md**: Checkpoint data model and behavior.
- **docs/claude-agent-sdk-guide.md**, **docs/codex-agent-guide.md**: SDK references.
- **STATE_MANAGEMENT_REFACTOR.md** (root): Implementation guide for parallel-workspace state refactor (already applied; can be moved to `docs/` or archived).

### Gaps

- **docs/electron-api.md**, **docs/prompt-building.md**, **docs/editor-integration.md** are referenced in CODEBASE-REFACTOR but not present.
- No CONTRIBUTING or high-level "where to add features" doc.

---

## 3. Cleanup list (what to clean)

### 3.1 Unused / dead code

| Item | Location | Action |
|------|----------|--------|
| UI examples | `packages/ui/src/examples/` (many `*-example.tsx`) | Not imported from `@agentide/ui`. Move to Storybook or remove if unused. |
| Duplicate ChatEditor | CODEBASE-REFACTOR §1.6 mentions two entry points | Only `chat-editor/` dir with `index.ts` + `chat-editor.tsx` exists; no standalone file. Doc is outdated; no file to delete. |
| pnpm lock | Root `pnpm-lock.yaml` | Project uses Bun (`bun.lock`). Remove if nothing uses pnpm. |

### 3.2 Type safety & API consistency

| Item | Location | Action |
|------|----------|--------|
| Git panel casts | `apps/app/src/components/git-changes-panel.tsx` | Multiple `(api?.workspace as { … })` for getStagedChanges, stageFile, unstageFile, revertFileChange, commit, push. `packages/shared/src/electron-api.ts` already declares these. Remove casts and use `getElectronAPI()` + shared `ElectronAPI`. |
| Agent skills API | `apps/app/src/components/agent-skills/agent-skills.tsx` | Uses `window.electronAPI?.skills` and custom `window` type. Use `getElectronAPI()?.skills` and shared `ElectronAPI` like rest of app. |

### 3.3 Duplicate logic to centralize

| Item | Location | Action |
|------|----------|--------|
| Path/string helpers | `dirname`/`basename` in git-changes-panel; `normalizeWorkspacePath` in agent-panel | Add `utils/path.ts` or `utils/git-path.ts` and reuse. |

### 3.4 Inconsistent patterns

| Item | Location | Action |
|------|----------|--------|
| Electron API access | All IPC via `getElectronAPI()` from `@/lib/electron` | Document in AGENT-GUIDELINES; ensure agent-skills uses same pattern. |
| Icon libraries | App uses `@agentide/ui` icons and `@tabler/icons-react`; packages/ui uses `@tabler/icons-react` and `lucide-react` | Consider standardizing on one set or a single re-export layer (lower priority). |

### 3.5 Deprecated / legacy

| Item | Location | Action |
|------|----------|--------|
| State refactor doc | `docs/STATE_MANAGEMENT_REFACTOR.md` | Refactor applied; kept in docs for reference. |

### 3.6 Tooling & quality

| Item | Location | Action |
|------|----------|--------|
| Biome linter | `biome.json`: `"linter": { "enabled": false }` | Enable linter (incrementally) to catch more issues. |
| Tests | No tests under `packages/agent`, `packages/shared`, `packages/ui`; no component tests in app | Add unit tests for shared and agent; consider component tests for critical UI. |

### 3.7 Large files (split candidates)

| File | ~Lines | Suggestion |
|------|--------|------------|
| `apps/desktop/src/ipc.ts` | ~1288 | Group handlers by domain (agent, workspace, chat, etc.) and re-export. |
| `apps/app/src/store/agent.store.ts` | ~1238 | Split: state, persistence, listeners (see CODEBASE-REFACTOR §3.3). |
| `packages/agent/src/custom-agent-backend.ts` | ~949 | Keep or split by provider when adding more. |
| `apps/app/src/components/tasks/tasks-page.tsx` | ~788 | Extract subcomponents or hooks. |
| `apps/app/src/components/agent/chat-editor/chat-editor.tsx` | ~652 | Extract toolbar, mode selector, or editor-area. |
| `packages/agent/src/tools/readlints.ts` | ~615 | Split helpers vs tool definition. |
| `apps/app/src/components/git-changes-panel.tsx` | ~561 | Extract staged/unstaged sections, commit/push bar, or hooks. |

### 3.8 Dependencies

- Run `depcheck` (or similar) to find unused production deps.
- `packages/ui`: scripts reference "turbo" but root has no turbo; Prettier/ESLint in ui while root uses Biome — align tooling if desired.

---

## 4. Tech stack (reference)

| Layer | Technology |
|-------|------------|
| Runtime | Electron 37, React 18, TypeScript 5.8 |
| Monorepo | Bun workspaces |
| Build | Vite 7 (app), tsup (desktop), tsc (shared, agent) |
| State | Zustand 5 |
| UI / styling | Tailwind CSS v4, design-system.css, Radix UI, Base UI (packages/ui), cva, tailwind-merge, clsx |
| Editor / chat | TipTap (mention, placeholder, starter-kit, suggestion), react-markdown, remark-gfm |
| Agent | Vercel AI SDK, @ai-sdk/anthropic, @ai-sdk/openai, vercel-minimax-ai-provider, zod |
| Terminal | @xterm/xterm, @xterm/addon-fit |
| Diffs / code | @pierre/diffs, shiki |
| Icons | @agentide/ui, @tabler/icons-react, @vscode/codicons, devicon |
| Format / lint | Biome (format on; linter off) |
| Test | Vitest 3 (app + desktop) |
| Packaging | electron-builder |

---

## 5. Priority summary (cleanup order)

| Priority | Item |
|----------|------|
| P0 | Remove Git panel casts; use shared `ElectronAPI` and `getElectronAPI()`. |
| P0 | Agent skills: use `getElectronAPI()?.skills` and shared types. |
| P1 | Move `STATE_MANAGEMENT_REFACTOR.md` to `docs/`. | ✓ Done |
| P1 | Remove root `pnpm-lock.yaml` if not used. |
| P1 | Add path utils (`utils/path.ts` or `utils/git-path.ts`) and refactor git-changes-panel and agent-panel. |
| P2 | Enable Biome linter incrementally. |
| P2 | Decide fate of `packages/ui/src/examples/` (Storybook vs remove). |
| P2 | Split largest files (ipc.ts, agent.store.ts) per CODEBASE-REFACTOR. |
| P3 | Standardize icons; run depcheck; align packages/ui tooling with root. |

---

## 6. Quick reference: key paths

```
agentide/
├── package.json
├── biome.json
├── tsconfig.base.json
├── README.md
├── docs/
│   ├── STATE_MANAGEMENT_REFACTOR.md
│   ├── CODEBASE-REFACTOR.md
│   ├── CODEBASE-CLEANUP.md
│   └── ...
├── packages/
│   ├── shared/src/         # types, electron-api, ipc-channels
│   ├── agent/src/          # agent-manager, custom-agent-backend, tools/
│   └── ui/src/             # components, icons, examples/
└── apps/
    ├── app/src/            # main.tsx, app.tsx, layouts/, components/, store/, lib/
    ├── desktop/src/        # main.ts, preload.ts, ipc.ts, services/, windows/
    └── cli/
```

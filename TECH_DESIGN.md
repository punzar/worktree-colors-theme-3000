# Worktree Colors Theme 3000 - Technical Design

## Overview

A VS Code extension that automatically assigns unique, persistent color themes to different git worktree directories. When you open a project in a git worktree, the extension detects the worktree path and applies a distinct color customization, making it easy to visually distinguish between multiple worktree windows at a glance.

## Problem

When working with multiple git worktrees of the same repository, all VS Code windows look identical. This leads to confusion — committing to the wrong branch, editing the wrong worktree, or losing track of which window corresponds to which worktree.

## Solution

Automatically assign a deterministic-but-varied color scheme to each worktree path. The colors persist across sessions (same worktree always gets the same colors) and are visually distinct from one another.

## Architecture

### Components

```
worktree-colors-theme-3000/
├── src/
│   ├── extension.ts          # Extension entry point, activation logic
│   ├── worktree-detector.ts  # Detect if current workspace is a git worktree
│   ├── color-generator.ts    # Generate deterministic colors from worktree path
│   ├── theme-applier.ts      # Apply color customizations to VS Code settings
│   └── config.ts             # User configuration handling
├── package.json              # Extension manifest
├── tsconfig.json
├── TECH_DESIGN.md
├── README.md
└── .vscodeignore
```

### 1. Worktree Detection (`worktree-detector.ts`)

**Responsibility:** Determine if the current workspace is inside a git worktree and extract a unique identifier for it.

**Approach:**
- On activation, read the workspace folder path.
- Run `git rev-parse --git-common-dir` and `git rev-parse --git-dir` to determine if the workspace is a worktree (they differ for worktrees).
- If it's a worktree, extract the worktree name from the path (last segment of the worktree directory).
- If it's not a worktree but is a regular git repo, optionally still assign a color based on the repo root path (configurable).

**Output:** A unique string identifier for the worktree (e.g., the worktree directory name or full path).

### 2. Color Generation (`color-generator.ts`)

**Responsibility:** Generate a visually distinct, deterministic color palette from a worktree identifier string.

**Approach:**
- Hash the worktree identifier using a simple hash function (e.g., FNV-1a or djb2) to get a numeric seed.
- Use the seed to pick a hue value (0-360) on the HSL color wheel.
- Generate a palette of related colors from that hue:
  - **Title bar background** — primary hue, moderate saturation
  - **Title bar foreground** — automatically computed for contrast (light/dark)
  - **Activity bar background** — slightly shifted hue
  - **Status bar background** — complementary or analogous hue
- Ensure colors have sufficient contrast and readability.

**Color Targets (VS Code `workbench.colorCustomizations`):**
```json
{
  "titleBar.activeBackground": "#...",
  "titleBar.activeForeground": "#...",
  "titleBar.inactiveBackground": "#...",
  "titleBar.inactiveForeground": "#...",
  "activityBar.background": "#...",
  "statusBar.background": "#...",
  "statusBar.foreground": "#..."
}
```

### 3. Theme Applier (`theme-applier.ts`)

**Responsibility:** Apply the generated colors to the current VS Code workspace.

**Approach:**
- Use the VS Code `workspace.getConfiguration()` API to write to `workbench.colorCustomizations` at the **workspace** level (not global).
- Only modify worktree-related color keys; preserve any existing user color customizations by merging.
- Provide a command to reset/remove worktree colors.

**Key decisions:**
- Write to **workspace settings** (`.vscode/settings.json`) so colors are scoped to the worktree and don't leak to other projects.
- Alternatively, use the VS Code `ConfigurationTarget.Workspace` so no file is written — colors live in memory/workspace state only. This avoids polluting the repo with `.vscode/settings.json` changes.

**Chosen approach:** Use `ConfigurationTarget.Workspace` with workspace state storage. Store the mapping in extension global state (`context.globalState`) so it persists but doesn't create files in the repo.

### 4. Configuration (`config.ts`)

**User-facing settings in `package.json` `contributes.configuration`:**

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `worktreeColors.enabled` | boolean | `true` | Enable/disable the extension |
| `worktreeColors.saturation` | number | `0.4` | Color saturation (0-1) |
| `worktreeColors.lightness` | number | `0.3` | Color lightness for dark themes (0-1) |
| `worktreeColors.lightnessLight` | number | `0.85` | Color lightness for light themes (0-1) |
| `worktreeColors.colorizeNonWorktree` | boolean | `false` | Also colorize regular (non-worktree) repos |
| `worktreeColors.colorTargets` | string[] | `["titleBar", "activityBar", "statusBar"]` | Which UI elements to colorize |

## Extension Lifecycle

```
Activation (onStartupFinished)
  │
  ├─ Detect workspace folder
  │
  ├─ Run git commands to check if worktree
  │   ├─ Not a worktree & colorizeNonWorktree=false → exit
  │   └─ Is a worktree (or colorizeNonWorktree=true)
  │       │
  │       ├─ Generate identifier string
  │       ├─ Hash → HSL hue
  │       ├─ Generate color palette
  │       └─ Apply to workbench.colorCustomizations
  │
  └─ Register commands:
      ├─ worktreeColors.refresh  — Re-detect and reapply
      ├─ worktreeColors.reset    — Remove worktree colors
      └─ worktreeColors.randomize — Pick a new random color
```

## Commands

| Command | Title | Description |
|---------|-------|-------------|
| `worktreeColors.refresh` | Worktree Colors: Refresh | Re-detect worktree and reapply colors |
| `worktreeColors.reset` | Worktree Colors: Reset | Remove all worktree color customizations |
| `worktreeColors.randomize` | Worktree Colors: Randomize | Assign a new random color (overrides deterministic) |

## Activation Events

- `onStartupFinished` — activate after VS Code has fully started to avoid slowing down startup.

## Technical Decisions

1. **Deterministic colors** — Same worktree path always produces the same color. Users don't need to configure anything; it just works. Override with `randomize` command if desired.

2. **Workspace-scoped settings** — Colors are applied via `ConfigurationTarget.Workspace` so they don't affect other projects or the user's global settings.

3. **No file system pollution** — Avoid writing to `.vscode/settings.json` in the worktree directory. Use VS Code's workspace state API instead to store any overrides.

4. **Dark/Light theme awareness** — Detect the current color theme kind (`window.activeColorTheme.kind`) and adjust lightness accordingly so colors look good in both dark and light themes. Listen to `onDidChangeActiveColorTheme` to re-apply.

5. **Minimal dependencies** — No external npm packages. Use built-in Node.js and VS Code APIs only.

## Development Setup

```bash
# Install dependencies
npm install

# Compile
npm run compile

# Watch mode
npm run watch

# Package extension
npx vsce package

# Run tests
npm test
```

## Tech Stack

- **Language:** TypeScript
- **Build:** esbuild (fast bundling)
- **Runtime:** VS Code Extension Host (Node.js)
- **Testing:** VS Code Extension Test framework + Mocha
- **Packaging:** vsce

## Implementation Phases (TDD)

Each phase follows Red-Green-Refactor: write failing tests first, implement the minimum code to pass, then refactor.

### Phase 0: Project Scaffold

**Goal:** Working build, test runner, and extension that activates without errors.

**Steps:**
1. Initialize project: `npm init`, install dev dependencies (`@types/vscode`, `@types/mocha`, `typescript`, `esbuild`, `@vscode/test-electron`, `mocha`).
2. Configure `tsconfig.json`, `esbuild.config.mjs`, `.vscodeignore`.
3. Create `package.json` extension manifest with `activationEvents: ["onStartupFinished"]`, empty `contributes`.
4. Create minimal `src/extension.ts` with empty `activate` / `deactivate`.
5. Create test runner config (`src/test/runTest.ts`, `src/test/suite/index.ts`).
6. Verify: `npm run compile` succeeds, `npm test` runs with 0 tests.

**Exit criteria:** Green CI — project compiles, test harness runs, extension activates in Extension Development Host.

---

### Phase 1: Color Generation (Pure Logic)

**Goal:** Deterministic, tested color generation with no VS Code dependencies.

**Tests first** (`src/test/suite/color-generator.test.ts`):
```typescript
// RED: write these tests before any implementation
it('returns a valid hex color palette for a given identifier')
it('is deterministic — same input always produces same output')
it('produces different hues for different identifiers')
it('respects saturation and lightness parameters')
it('generates light foreground for dark backgrounds and vice versa')
it('adjusts palette for light theme kind vs dark theme kind')
```

**Then implement** (`src/color-generator.ts`):
- `hashString(input: string): number` — FNV-1a hash
- `hslToHex(h: number, s: number, l: number): string`
- `contrastForeground(bgHex: string): string`
- `generatePalette(identifier: string, config: ColorConfig): ColorPalette`

**Refactor:** Extract `ColorPalette` and `ColorConfig` types to a shared `types.ts` if needed.

**Exit criteria:** All color generation tests green. No VS Code API imports in this module.

---

### Phase 2: Worktree Detection

**Goal:** Reliably detect git worktrees and extract identifiers.

**Tests first** (`src/test/suite/worktree-detector.test.ts`):
```typescript
// RED: write these tests before any implementation
it('returns worktree info when inside a git worktree')
it('returns null when not inside a git repo')
it('returns non-worktree info for a regular git repo')
it('extracts worktree name from git-dir path')
it('handles git command failures gracefully')
```

**Test setup:** Create temporary git repos and worktrees in a temp directory during `before()`. Clean up in `after()`.

**Then implement** (`src/worktree-detector.ts`):
- `execGit(args: string[], cwd: string): Promise<string>` — shell out to git
- `detectWorktree(workspacePath: string): Promise<WorktreeInfo | null>`

**Exit criteria:** All detection tests green against real git repos created in temp dirs.

---

### Phase 3: Configuration

**Goal:** Type-safe config reading with defaults.

**Tests first** (`src/test/suite/config.test.ts`):
```typescript
// RED: write these tests before any implementation
it('returns default values when no config is set')
it('reads saturation from workspace configuration')
it('reads lightness based on theme kind')
it('returns configured color targets')
it('respects colorizeNonWorktree setting')
```

**Then implement** (`src/config.ts`):
- `getConfig(): WorktreeColorsConfig` — reads from `vscode.workspace.getConfiguration('worktreeColors')`

**Also:** Add `contributes.configuration` to `package.json` with all settings, types, defaults, and descriptions.

**Exit criteria:** Config tests green. `package.json` contributes section complete.

---

### Phase 4: Theme Application

**Goal:** Apply and remove color customizations without clobbering user settings.

**Tests first** (`src/test/suite/theme-applier.test.ts`):
```typescript
// RED: write these tests before any implementation
it('applies color palette to workbench.colorCustomizations')
it('merges with existing user color customizations')
it('only sets keys for configured color targets')
it('reset removes only worktree-managed keys')
it('reset preserves user-set color customizations')
```

**Test approach:** Mock `vscode.workspace.getConfiguration` to assert the correct keys and values are written.

**Then implement** (`src/theme-applier.ts`):
- `applyColors(palette: ColorPalette, targets: string[]): Promise<void>`
- `resetColors(targets: string[]): Promise<void>`

**Exit criteria:** All applier tests green. Manual verification in Extension Development Host that title bar changes color.

---

### Phase 5: Extension Wiring & Commands

**Goal:** Full pipeline working end-to-end with all three commands.

**Tests first** (`src/test/suite/extension.test.ts`):
```typescript
// RED: write these tests before any implementation
it('activates without error')
it('applies colors when workspace is a worktree')
it('does nothing when workspace is not a worktree and colorizeNonWorktree is false')
it('refresh command re-detects and reapplies')
it('reset command removes all worktree colors')
it('randomize command stores override in globalState and applies new color')
it('reapplies colors when active color theme changes')
```

**Then implement** (`src/extension.ts`):
- Wire the pipeline: detect → config → generate → apply
- Register commands: `worktreeColors.refresh`, `worktreeColors.reset`, `worktreeColors.randomize`
- Listen to `onDidChangeActiveColorTheme` to re-run pipeline
- Store randomize overrides in `context.globalState`

**Also:** Add `contributes.commands` to `package.json`.

**Exit criteria:** All integration tests green. Manual E2E test: open two worktrees side-by-side and confirm they get different colors.

---

### Phase 6: Polish & Package

**Goal:** Ready for marketplace publication.

**Steps:**
1. Add extension icon (128x128 PNG).
2. Write marketplace description in `package.json` (`displayName`, `description`, `categories`, `keywords`).
3. Add `.vscodeignore` to exclude test files, source maps, and config from the packaged extension.
4. Run `npx vsce package` and verify the `.vsix` installs cleanly.
5. Test on both dark and light themes.
6. Test with no git repo, regular git repo, and git worktree.

**Exit criteria:** `.vsix` installs, all tests green, all manual scenarios verified.

---

### Phase Summary

| Phase | Module | Test Count (approx) | Depends On |
|-------|--------|---------------------|------------|
| 0 | Scaffold | 0 (build check) | — |
| 1 | `color-generator.ts` | 6 | Phase 0 |
| 2 | `worktree-detector.ts` | 5 | Phase 0 |
| 3 | `config.ts` | 5 | Phase 0 |
| 4 | `theme-applier.ts` | 5 | Phase 1 |
| 5 | `extension.ts` | 7 | Phases 1-4 |
| 6 | Packaging | 0 (manual) | Phase 5 |

Phases 1, 2, and 3 are independent and can be worked on in parallel.

## Future Considerations

- Support for Remote SSH / Dev Container / Codespaces worktrees
- Color palette presets (pastel, vibrant, muted)
- Status bar indicator showing current worktree name
- Integration with `git worktree list` to show all worktrees and their assigned colors

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

## Future Considerations

- Support for Remote SSH / Dev Container / Codespaces worktrees
- Color palette presets (pastel, vibrant, muted)
- Status bar indicator showing current worktree name
- Integration with `git worktree list` to show all worktrees and their assigned colors

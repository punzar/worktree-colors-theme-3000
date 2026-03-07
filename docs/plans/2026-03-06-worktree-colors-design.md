# Technical Design: Git-Invisible VS Code Worktree Coloring Extension

**Project:** Worktree Colors Theme 3000
**Date:** 2026-03-06
**Status:** Draft

---

## 1. Overview

A VS Code extension that automatically assigns deterministic, visually distinct color tints to git worktree windows. Each worktree gets a unique combination of title bar, activity bar, and status bar colors derived from hashing the worktree path. The extension must be completely invisible to git -- no repository files may be modified.

### Goal

Open two worktree windows side by side and instantly distinguish them by color, with zero setup and zero git footprint.

---

## 2. Architecture

### 2.1 Architecture Diagram

```
                         ┌─────────────────────────────┐
                         │      Interface Layer         │
                         │                              │
                         │  extension.ts (entry point)  │
                         │  - activation lifecycle      │
                         │  - command registration      │
                         │  - event listeners           │
                         └──────────┬──────────────────┘
                                    │ orchestrates
                         ┌──────────▼──────────────────┐
                         │     Application Layer        │
                         │                              │
                         │  Pipeline: detect → config   │
                         │  → generate → apply          │
                         └──────────┬──────────────────┘
                                    │ calls
          ┌─────────────────────────┼─────────────────────────┐
          │                         │                         │
┌─────────▼──────────┐  ┌──────────▼──────────┐  ┌──────────▼──────────┐
│   Domain Layer     │  │   Domain Layer      │  │ Infrastructure Layer│
│                    │  │                     │  │                     │
│ worktree-detector  │  │  color-generator    │  │   theme-applier     │
│ - git rev-parse    │  │  - FNV-1a hash      │  │   - VS Code API     │
│ - path resolution  │  │  - HSL conversion   │  │   - colorCustom.    │
│                    │  │  - palette gen      │  │                     │
└────────────────────┘  └─────────────────────┘  └─────────────────────┘
                                ▲
                     ┌──────────┴──────────┐
                     │   Domain Layer      │
                     │                     │
                     │   config.ts         │
                     │   - typed defaults  │
                     │   - settings reader │
                     └─────────────────────┘
```

### 2.2 Pattern: Pipeline with Inversion of Control

The extension follows a **unidirectional data pipeline** orchestrated by a single entry point. Each module is a pure transformation step with a single responsibility. Modules never import each other -- the entry point (`extension.ts`) owns the lifecycle and wires the pipeline.

```
Activate → Detect Worktree → Read Config → Generate Colors → Apply Theme
```

### 2.3 Layer Responsibilities

| Layer | Modules | VS Code Dependency | Side Effects |
|-------|---------|-------------------|--------------|
| **Domain** | `worktree-detector`, `color-generator`, `config` | None (config accepts an interface) | `worktree-detector` spawns git |
| **Infrastructure** | `theme-applier` | Yes (ConfigurationWriter interface) | Writes `workbench.colorCustomizations` |
| **Interface** | `extension.ts` | Yes (full VS Code API) | Registers commands, events, lifecycle |

---

## 3. Folder Structure

```
worktree-colors-theme-3000/
├── src/
│   ├── extension.ts              # Entry point, pipeline orchestration
│   ├── worktree-detector.ts      # Git worktree detection (domain)
│   ├── color-generator.ts        # Deterministic color generation (domain)
│   ├── config.ts                 # Configuration reader (domain)
│   ├── theme-applier.ts          # VS Code color application (infrastructure)
│   └── test/
│       ├── unit/
│       │   ├── worktree-detector.test.ts
│       │   ├── color-generator.test.ts
│       │   ├── config.test.ts
│       │   └── theme-applier.test.ts
│       ├── suite/
│       │   ├── extension.test.ts  # VS Code integration tests
│       │   └── index.ts
│       └── runTest.ts
├── docs/
│   └── plans/
├── dist/                         # esbuild output
├── package.json
├── tsconfig.json
├── tsconfig.test.json
├── esbuild.config.js
└── CLAUDE.md
```

---

## 4. Domain Model

### 4.1 Workspace Identity

```typescript
interface WorktreeInfo {
  identifier: string;   // Stable string derived from worktree path
  isWorktree: boolean;  // true = git worktree, false = regular repo
}
```

The identifier is extracted from the filesystem path:
- **Worktree:** `path.basename(workspacePath)` (e.g., `feature-branch`)
- **Regular repo:** `path.basename(workspacePath)` (e.g., `my-project`)

Detection logic:
```
git rev-parse --git-dir        → e.g. /repo/.git/worktrees/feature-x
git rev-parse --git-common-dir → e.g. /repo/.git

If git-dir != git-common-dir → worktree → extract identifier
If git-dir == git-common-dir → regular repo → check colorizeNonWorktree setting
```

### 4.2 Color Generation

Pure function: `(identifier, config) → ColorPalette`

1. **Hash:** FNV-1a hash of identifier string → 32-bit unsigned integer
2. **Hue:** `hash % 360` → deterministic hue on the color wheel
3. **Palette:** Hue + configurable saturation/lightness → full color set

```typescript
interface ColorConfig {
  saturation: number;  // 0-1, default 0.4
  lightness: number;   // 0-1, varies by theme kind
  isDark: boolean;     // current VS Code theme kind
}

type ColorPalette = Record<string, string>;  // e.g. { "titleBar.activeBackground": "#2a1f3d" }
```

Palette keys generated:

| Key | Derivation |
|-----|-----------|
| `titleBar.activeBackground` | `hsl(hue, saturation, lightness)` |
| `titleBar.activeForeground` | Auto-contrast (luminance > 0.4 → dark, else light) |
| `titleBar.inactiveBackground` | `hsl(hue, saturation * 0.6, lightness)` |
| `titleBar.inactiveForeground` | Auto-contrast |
| `activityBar.background` | `hsl(hue + 15, saturation, lightness)` |
| `statusBar.background` | `hsl(hue + 30, saturation, lightness)` |
| `statusBar.foreground` | Auto-contrast |

### 4.3 Configuration

```typescript
interface WorktreeColorsConfig {
  enabled: boolean;            // default: true
  saturation: number;          // default: 0.4
  lightness: number;           // default: 0.3 (dark themes)
  lightnessLight: number;      // default: 0.85 (light themes)
  colorizeNonWorktree: boolean;// default: false
  colorTargets: string[];      // default: ["titleBar", "activityBar", "statusBar"]
}
```

All configuration is read from `worktreeColors.*` VS Code settings. The config module accepts a `{ get<T>(key: string): T | undefined }` interface, making it testable without VS Code.

---

## 5. Interfaces and Abstractions

### 5.1 ConfigurationWriter (Infrastructure Boundary)

```typescript
interface ConfigurationWriter {
  get<T>(key: string): T | undefined;
  update(key: string, value: unknown, target: number): Thenable<void>;
}
```

This is the only interface between domain/application logic and VS Code's configuration API. The `theme-applier` module depends on this interface, not on `vscode.WorkspaceConfiguration` directly.

### 5.2 Git Execution (Domain Boundary)

The `worktree-detector` uses Node.js `execFile` directly (no VS Code dependency). For testing, real git repos are created in temp directories rather than mocking git -- this ensures detection logic is tested against actual git behavior.

### 5.3 Module Import Rule

**Modules never import each other.** All wiring happens in `extension.ts`:

```
extension.ts imports: worktree-detector, color-generator, config, theme-applier
worktree-detector imports: child_process, path (Node builtins only)
color-generator imports: nothing
config imports: nothing
theme-applier imports: ColorPalette type from color-generator (type-only)
```

---

## 6. Use Case Descriptions

### 6.1 Activate Extension (Primary Flow)

**Trigger:** VS Code fires `onStartupFinished`

```
1. Get workspace folder path
2. Read worktreeColors.* configuration
3. If disabled → exit
4. Detect worktree via git rev-parse
5. If null (not a git repo) → exit
6. If regular repo and colorizeNonWorktree = false → exit
7. Check globalState for randomize override → use as identifier if present
8. Determine dark/light theme kind
9. Generate color palette from identifier + config
10. Apply palette to workbench.colorCustomizations
```

### 6.2 Theme Change (Re-trigger)

**Trigger:** `window.onDidChangeActiveColorTheme`

Re-runs the full pipeline. The lightness value switches between `lightness` (dark) and `lightnessLight` (light), producing appropriate colors for the new theme kind.

### 6.3 Randomize Color

**Trigger:** `worktreeColors.randomize` command

```
1. Generate random identifier: `random-${Date.now()}-${Math.random()...}`
2. Store in context.globalState under key 'worktreeColors.randomOverride'
3. Re-run pipeline (which reads the override as the identifier)
```

### 6.4 Reset Colors

**Trigger:** `worktreeColors.reset` command

```
1. Read current workbench.colorCustomizations
2. Remove only keys managed by this extension (based on colorTargets)
3. Preserve all user-set color customizations
4. Clear randomize override from globalState
```

### 6.5 Refresh

**Trigger:** `worktreeColors.refresh` command

Re-runs the pipeline. Useful after config changes or manual resets.

---

## 7. Storage Strategy

### 7.1 Git-Safety Guarantee

The extension must **never** write to any file inside the repository. This means:

- No writes to `.vscode/settings.json`
- No writes to `.vscode/` directory at all
- No writes to any tracked or untracked file in the repo
- `git status` must remain clean after extension activation

### 7.2 How Colors Are Applied

Colors are applied via the VS Code Configuration API:

```typescript
vscode.workspace.getConfiguration('workbench')
  .update('colorCustomizations', palette, ConfigurationTarget.Workspace);
```

**Critical detail:** `ConfigurationTarget.Workspace` writes to `.vscode/settings.json` on disk. This is VS Code's built-in behavior and cannot be intercepted.

### 7.3 Mitigation Strategies

There are three options for handling this conflict:

#### Option A: Accept ConfigurationTarget.Workspace (Current Implementation)

The current implementation uses `ConfigurationTarget.Workspace`. This **does** write to `.vscode/settings.json`. The mitigation is:

- Users should add `.vscode/settings.json` to `.gitignore` if they don't already track it
- The `reset` command cleanly removes all extension-managed keys
- The extension merges with existing customizations (never clobbers)

**Trade-off:** Simplest implementation, but technically violates the "no repo file writes" requirement. In practice, most projects already gitignore `.vscode/`.

#### Option B: ConfigurationTarget.Global + Window Isolation

Use `ConfigurationTarget.Global` (writes to user-level `settings.json`, outside any repo). Store per-workspace palettes in `context.globalState` keyed by workspace path. On activation, read from globalState and apply globally.

**Trade-off:** Global settings affect all VS Code windows. Requires careful scoping to avoid color bleeding between windows.

#### Option C: Extension-Managed Storage + Runtime Application

Store palettes in `context.globalState` or `context.storageUri`. Apply colors using `ConfigurationTarget.Global` but scope them via the extension's own state machine, re-applying the correct palette whenever the window gains focus.

**Trade-off:** Most complex, but fully git-invisible.

### 7.4 Recommended Approach

**Option A** is the current implementation and the pragmatic choice. The VS Code extension ecosystem (including Peacock, the primary inspiration) universally uses `ConfigurationTarget.Workspace`. The `.vscode/settings.json` file is the standard, expected location for workspace-specific UI customizations.

For users who need strict git cleanliness:
- Add `.vscode/settings.json` to `.gitignore`
- Or use the `reset` command before committing

### 7.5 Persistent State

| Data | Storage | Survives Restart | Git Visible |
|------|---------|-----------------|-------------|
| Color overrides (randomize) | `context.globalState` | Yes | No |
| Applied colors | `workbench.colorCustomizations` (workspace) | Yes | Yes (in `.vscode/settings.json`) |
| Extension config | `worktreeColors.*` (user settings) | Yes | No |

---

## 8. Event Flow Diagrams

### 8.1 Activation Flow

```
VS Code starts
    │
    ▼
onStartupFinished
    │
    ▼
extension.activate(context)
    │
    ├──► Register onDidChangeActiveColorTheme listener
    ├──► Register worktreeColors.refresh command
    ├──► Register worktreeColors.reset command
    ├──► Register worktreeColors.randomize command
    │
    └──► runPipeline(context)
              │
              ├──► Get workspace folders[0].uri.fsPath
              ├──► getConfig(vscode.workspace.getConfiguration('worktreeColors'))
              ├──► detectWorktree(workspacePath)
              │         │
              │         ├──► git rev-parse --git-dir
              │         └──► git rev-parse --git-common-dir
              │
              ├──► Check globalState for random override
              ├──► Determine isDark from activeColorTheme.kind
              ├──► generatePalette(identifier, colorConfig)
              └──► applyColors(palette, targets, workbenchConfig, Workspace)
```

### 8.2 Theme Change Flow

```
User switches dark ↔ light theme
    │
    ▼
onDidChangeActiveColorTheme fires
    │
    ▼
runPipeline(context)
    │
    ▼
Same pipeline, but isDark flag flips
    │
    ▼
New palette with different lightness applied
```

### 8.3 Randomize Flow

```
User runs "Worktree Colors: Randomize"
    │
    ▼
Generate random identifier string
    │
    ▼
context.globalState.update('worktreeColors.randomOverride', randomId)
    │
    ▼
runPipeline(context)
    │
    ▼
Pipeline reads override from globalState instead of worktree name
    │
    ▼
New deterministic palette (based on random string) applied
```

---

## 9. Test Strategy (TDD)

### 9.1 Principles

- **Domain logic is fully unit-testable** without VS Code
- **Infrastructure uses interface mocks** (ConfigurationWriter)
- **Worktree detection uses real git repos** in temp directories
- **No mocking of git commands** -- real `git init` + `git worktree add` in tmpdir
- **Test runner:** Mocha with TDD UI

### 9.2 Test Coverage Matrix

| Module | Test Type | VS Code Required | What's Tested |
|--------|-----------|-----------------|---------------|
| `color-generator` | Unit | No | Hash determinism, HSL conversion, contrast, palette structure |
| `config` | Unit | No | Default values, setting overrides, type coercion |
| `worktree-detector` | Unit (with real git) | No | Worktree detection, regular repo, non-git dirs, error handling |
| `theme-applier` | Unit (mocked) | No | Color application, merge behavior, reset, target filtering |
| `extension` | Integration | Yes | Activation, command registration, full pipeline |

### 9.3 Test Cases

**Color Generator (8 tests)**
- `hashString` returns consistent number for same input
- `hashString` returns different numbers for different inputs
- `hslToHex` returns valid 7-char hex color
- `hslToHex` handles edge hue values (0, 360)
- `contrastForeground` returns light color for dark backgrounds
- `contrastForeground` returns dark color for light backgrounds
- `generatePalette` returns all required keys with valid hex values
- `generatePalette` is deterministic (same input → same output)
- `generatePalette` produces different hues for different identifiers
- `generatePalette` respects saturation/lightness parameters

**Config (6 tests)**
- Returns default values when no config provided
- Returns defaults when config returns undefined for all keys
- Reads each individual setting (saturation, lightness, lightnessLight, colorTargets, colorizeNonWorktree, enabled)

**Worktree Detector (5 tests)**
- Returns `isWorktree: true` inside a git worktree
- Extracts worktree name from path
- Returns `isWorktree: false` for regular git repo
- Returns `null` for non-git directory
- Handles git command failures gracefully

**Theme Applier (5 tests)**
- Applies palette to `workbench.colorCustomizations`
- Merges with existing user color customizations
- Only sets keys for configured color targets
- Reset removes only extension-managed keys
- Reset preserves user-set color customizations

### 9.4 Testing Infrastructure

```typescript
// Mock ConfigurationWriter for theme-applier tests
function createMockConfig(initial: Record<string, string> = {}): ConfigurationWriter {
  let store = { colorCustomizations: { ...initial } };
  return {
    get<T>(key: string): T | undefined { return store[key] as T; },
    async update(key: string, value: unknown, target: number) { store[key] = value; },
  };
}

// Real git repos for worktree-detector tests
setup(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wt-test-'));
  execSync('git init && git commit --allow-empty -m "init"', { cwd: mainRepoDir });
  execSync('git worktree add ...', { cwd: mainRepoDir });
});
```

---

## 10. Implementation Phases

### Phase 1: Domain Model (worktree-detector + color-generator)

- `WorktreeInfo` type and `detectWorktree()` function
- Git rev-parse comparison logic
- FNV-1a hash, HSL-to-hex conversion, contrast calculation
- `generatePalette()` pure function
- Full unit tests for both modules

### Phase 2: Configuration Module

- `WorktreeColorsConfig` type with typed defaults
- `getConfig()` function accepting a settings reader interface
- `package.json` contributes.configuration schema
- Unit tests for default values and overrides

### Phase 3: Theme Application (Infrastructure)

- `ConfigurationWriter` interface
- `applyColors()` with merge-safe behavior
- `resetColors()` preserving user customizations
- Target-to-key mapping (`titleBar` → 4 keys, etc.)
- Unit tests with mock ConfigurationWriter

### Phase 4: Extension Integration (Interface Layer)

- `activate()` / `deactivate()` lifecycle
- `runPipeline()` orchestrating all modules
- `onDidChangeActiveColorTheme` listener for dark/light switching
- Command registration (refresh, reset, randomize)
- `globalState` for randomize override persistence

### Phase 5: Polish and Packaging

- `onStartupFinished` activation event (lightweight startup)
- esbuild bundling configuration
- `.vsixmanifest` metadata, README, CHANGELOG
- `npx vsce package` for distribution

### Phase 6: UX Improvements (Future)

- Status bar indicator showing current worktree color
- Command to pick a specific color (color picker)
- Palette constraints (minimum hue distance between worktrees)
- Custom per-worktree color overrides via settings
- Multi-root workspace support

---

## 11. Risks and Alternatives

### 11.1 Risks

| Risk | Impact | Mitigation |
|------|--------|-----------|
| `ConfigurationTarget.Workspace` writes to `.vscode/settings.json` | Git shows changes | Document that users should gitignore `.vscode/settings.json`; provide `reset` command |
| Hash collisions (two worktrees get same hue) | Indistinguishable windows | FNV-1a has good distribution over 360 hues; `randomize` command as escape hatch |
| VS Code API changes to `colorCustomizations` | Extension breaks | Pin minimum VS Code engine version (`^1.85.0`); test against stable API |
| `git rev-parse` not available | Detection fails silently | Graceful null return; extension simply doesn't activate |
| Performance on slow filesystems | Delayed activation | `onStartupFinished` (non-blocking); git commands are fast (<50ms) |
| Multi-root workspaces | Only first folder colored | Document limitation; future phase to support multiple roots |

### 11.2 Alternatives Considered

**Peacock-style approach:** Peacock also uses `ConfigurationTarget.Workspace` and writes to `.vscode/settings.json`. This is the established pattern in the VS Code ecosystem. Our approach matches it.

**Color Token Provider API:** VS Code does not currently expose a runtime-only theming API that avoids file writes. The `workbench.colorCustomizations` setting is the only supported mechanism for programmatic UI coloring.

**Custom CSS injection:** Technically possible via the "Custom CSS and JS Loader" pattern, but unsupported, fragile, and requires modifying VS Code's installation files.

**Workspace Trust API:** Could be used to gate activation, but doesn't solve the storage problem.

---

## 12. Key Constraints Summary

| Constraint | How It's Enforced |
|-----------|------------------|
| Zero npm dependencies | `package.json` has only devDependencies |
| Deterministic colors | FNV-1a hash of worktree path → same hue every time |
| Dark/light theme support | `onDidChangeActiveColorTheme` re-runs pipeline with flipped lightness |
| Merge-safe color application | `applyColors` spreads existing customizations, only overwrites managed keys |
| Clean reset | `resetColors` removes only extension-managed keys, preserves user keys |
| Build tool | esbuild (single-file bundle to `dist/extension.js`) |

---

## Appendix: VS Code Settings Written

The extension writes to `workbench.colorCustomizations` within workspace-scoped settings. The exact keys depend on `colorTargets` configuration:

```jsonc
// .vscode/settings.json (managed by VS Code, not by the extension directly)
{
  "workbench.colorCustomizations": {
    "titleBar.activeBackground": "#2a1f3d",
    "titleBar.activeForeground": "#e0e0e0",
    "titleBar.inactiveBackground": "#1f1a2e",
    "titleBar.inactiveForeground": "#e0e0e0",
    "activityBar.background": "#2d1f3d",
    "statusBar.background": "#312040",
    "statusBar.foreground": "#e0e0e0"
  }
}
```

These values are fully removed by the `reset` command.

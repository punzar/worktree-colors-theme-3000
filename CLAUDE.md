# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

VS Code extension that auto-assigns deterministic color themes to git worktree directories. Colors are derived by hashing the worktree path to an HSL hue and applied via `workbench.colorCustomizations` at workspace scope.

## Build Commands

```bash
npm install          # install dependencies
npm run compile      # compile TypeScript
npm run watch        # compile in watch mode
npm test             # run tests (VS Code Extension Test + Mocha)
npx vsce package     # package .vsix for distribution
```

## Architecture

### Pattern: Pipeline with Inversion of Control

The extension follows a **unidirectional data pipeline** orchestrated by a central entry point. Each module is a pure transformation step with a single responsibility. The entry point (`extension.ts`) owns the lifecycle and wires the pipeline together — individual modules never import each other.

```
┌─────────────┐    ┌──────────────────┐    ┌───────────────────┐    ┌────────────────┐
│   Activate   │───>│  Detect Worktree │───>│  Generate Colors  │───>│  Apply Theme   │
│ extension.ts │    │ worktree-detector│    │  color-generator  │    │  theme-applier  │
└─────────────┘    └──────────────────┘    └───────────────────┘    └────────────────┘
       │                                           ▲
       │           ┌──────────────────┐            │
       └──────────>│   Read Config    │────────────┘
                   │    config.ts     │  (saturation, lightness,
                   └──────────────────┘   theme kind, targets)
```

### Module Contracts

| Module | Input | Output | Side Effects |
|--------|-------|--------|-------------|
| `worktree-detector.ts` | Workspace folder path | `WorktreeInfo \| null` (identifier string, isWorktree flag) | Spawns `git rev-parse` |
| `color-generator.ts` | Identifier string + config (saturation, lightness, theme kind) | Color palette (`Record<string, string>`) | None (pure function) |
| `theme-applier.ts` | Color palette | void | Writes `workbench.colorCustomizations` via VS Code API |
| `config.ts` | None | Typed config object | Reads `worktreeColors.*` settings |
| `extension.ts` | VS Code `ExtensionContext` | void | Registers commands, wires pipeline, listens to theme changes |

### Data Flow Rules

- **Config is read-only input** — `config.ts` provides values to the pipeline, never mutates state.
- **Color generation is pure** — given the same identifier + config, always returns the same palette. No randomness unless `randomize` command overrides the identifier (stored in `context.globalState`).
- **Theme applier is the only writer** — the single place that touches VS Code workspace settings. Merges with existing user customizations; never clobbers.
- **Entry point owns re-triggering** — listens to `onDidChangeActiveColorTheme` and re-runs the pipeline when the user switches dark/light themes.

### Worktree Detection Logic

```
git rev-parse --git-dir        → e.g. /repo/.git/worktrees/feature-x
git rev-parse --git-common-dir → e.g. /repo/.git

If git-dir ≠ git-common-dir → it's a worktree → extract identifier
If git-dir = git-common-dir → regular repo → check colorizeNonWorktree setting
```

### Color Generation Strategy

1. Hash worktree identifier (FNV-1a or djb2) → numeric seed
2. Seed → HSL hue (0-360)
3. Hue + config saturation + config lightness (dark or light variant) → palette:
   - `titleBar.activeBackground` / `activeForeground` (auto-contrast)
   - `activityBar.background` (hue + slight offset)
   - `statusBar.background` / `foreground` (complementary shift)

## Key Constraints

- Zero external npm dependencies — only Node.js builtins and VS Code API
- Never write to `.vscode/settings.json` in the repo — use `ConfigurationTarget.Workspace` + `context.globalState`
- Colors must be deterministic: same worktree path → same color
- Must handle both dark and light themes (listen to `onDidChangeActiveColorTheme`)
- Build tool is esbuild

## Architectural Rules (Enforced by Linter)

These rules are enforced by ESLint. Violations will block commits via pre-commit hook.

### Dependency Direction

- **Pipeline modules (`color-generator`, `worktree-detector`, `config`, `theme-applier`, `status-bar`, `color-picker`) MUST NOT import each other.**
- Only `extension.ts` wires modules together — it is the composition root.
- If a module needs a type from another module, use `import type` (type-only imports are allowed) or define an interface locally.
- Exception: `theme-applier.ts` may import the `ColorPalette` type from `color-generator.ts`.

### Type Safety

- `any` is banned in production code (`src/*.ts` excluding tests). Use `unknown` and narrow with type guards.
- All exported functions must have explicit return types.
- All `Promise`-returning calls must be `await`ed or explicitly voided with `void`.
- No non-null assertions (`!`). Use proper null checks.

### Adding New Modules

When adding a new module to the pipeline:
1. Create the module in `src/` as a pure function with a single responsibility.
2. Create unit tests in `src/test/unit/`.
3. Wire it into the pipeline from `extension.ts` only.
4. Add it to the `no-restricted-imports` boundary rules in `eslint.config.mjs`.
5. Update the architecture diagram above.

### Testing Rules

- Every exported function must have a corresponding test file in `src/test/unit/`.
- Tests for pure functions should not mock — use real inputs/outputs.
- Tests for modules with side effects (like `theme-applier`) should inject dependencies via interfaces (e.g., `ConfigurationWriter`).
- Test files may use `any` — they are exempt from strict type rules.

## Lint Commands

```bash
npm run lint          # check for lint errors
npm run lint:fix      # auto-fix what's possible
```

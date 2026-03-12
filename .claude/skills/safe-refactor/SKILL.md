---
name: safe-refactor
description: Guides safe refactoring of existing pipeline modules with before/after test verification and architectural boundary preservation. Use when user says "refactor", "restructure", "rename", "extract function", "move code", "clean up", or "simplify module".
metadata:
  author: worktree-colors-theme-3000
  version: 1.0.0
---

# Safe Refactor

Ensures refactoring never breaks tests, changes behavior, or violates architectural boundaries.

## Pre-flight

CRITICAL: Complete ALL checks before changing any code.

1. Run `npm test` — all tests must PASS. If not, fix tests first (separate commit).
2. Run `npm run lint` — zero errors. If not, fix lint first (separate commit).
3. Identify blast radius: which modules and tests does this change touch?
4. Confirm: is this ONLY a refactor (same behavior, different structure)?

If this changes behavior, it is NOT a refactor — use a feat/fix workflow instead.

## Rules

- **Dependency direction is sacred.** Pipeline modules must not import each other after refactoring.
- **Public signatures are contracts.** Never change an exported function's signature without updating ALL callers AND tests.
- **Deletion requires proof.** Before deleting an exported symbol, grep the entire `src/` directory to confirm zero usages.
- **Pure stays pure.** If a function has no side effects now, it must have no side effects after refactoring.

## Step 1: Capture Baseline

```bash
npm test && npm run lint
```

Save the output. Record the number of passing tests.

## Step 2: Make ONE Logical Change

One refactoring action per commit. Do NOT mix:
- Renaming + restructuring
- Extracting + behavior changes
- Cleanup + new features

## Step 3: Verify Equivalence

```bash
npm test && npm run lint
```

Compare with Step 1:
- Same number of tests pass
- Zero new lint errors
- No skipped or pending tests

## Step 4: Run Architecture Check

```bash
bash .claude/scripts/check-architecture.sh
```

Expected: PASSED

## Step 5: Commit

Commit message prefix: `refactor:` (never `feat:` or `fix:` for refactoring).

## Troubleshooting

### Test count changed after refactoring
You accidentally changed behavior. Revert and break the refactor into smaller steps.

### New lint errors after renaming
Check that renamed exports are updated in `eslint.config.mjs` boundary rules and in `CLAUDE.md`.

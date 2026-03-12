---
name: pre-commit-check
description: Run before any git commit to verify lint, tests, and architecture checks all pass. Use when user says "commit", "ready to commit", "check before commit", or "verify changes". Do NOT use for simple git status checks.
metadata:
  author: worktree-colors-theme-3000
  version: 1.0.0
---

# Pre-Commit Check

Validates all quality gates before committing code.

## Instructions

Run these checks in order. ALL must pass before committing.

### 1. Lint

```bash
npm run lint
```

Expected: 0 errors, 0 warnings.

If lint fails: fix violations first. Do NOT use `// eslint-disable` without a documented justification.

### 2. Tests

```bash
npm test
```

Expected: All tests pass with 0 failures.

If tests fail: fix the code or the test. Never skip a failing test to unblock a commit.

### 3. Architecture Validation

```bash
bash .claude/scripts/check-architecture.sh
```

Expected: PASSED.

If it fails: you likely added a new module without updating boundary rules, tests, or documentation. Follow the `new-pipeline-module` skill.

### 4. Commit

Only after all 3 checks pass:

```bash
git add <specific files>
git commit -m "<type>: <description>"
```

Use conventional commit prefixes: `feat:`, `fix:`, `refactor:`, `chore:`, `docs:`, `test:`.

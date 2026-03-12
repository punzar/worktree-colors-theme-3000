# AI-Driven Architecture Enforcement System

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create a system of linter rules, CLAUDE.md rules, and project-specific skills that enforce the existing pipeline architecture — making it structurally difficult for AI agents (or humans) to produce poorly structured or untestable code.

**Architecture:** The enforcement system has three layers: (1) ESLint with `@typescript-eslint` and `eslint-plugin-import` enforces dependency direction, bans `any`, and limits module coupling at the syntax level; (2) enhanced `CLAUDE.md` rules give AI agents architectural context and hard constraints; (3) a pre-commit hook runs lint + tests as a final gate. The project's existing Pipeline-with-IoC pattern already IS the Clean Architecture for this scale — we formalize it rather than restructure.

**Tech Stack:** ESLint 9 (flat config), @typescript-eslint, eslint-plugin-import, husky + lint-staged (pre-commit)

---

## Design Decisions

### Why ESLint Over Biome?

Biome is faster but lacks the `eslint-plugin-import` ecosystem needed to enforce dependency direction rules (e.g. "modules may not import each other — only `extension.ts` wires the pipeline"). ESLint's `no-restricted-imports` and `import/no-internal-modules` give us the architectural boundary enforcement that is the core value of this system.

### Clean Architecture at This Scale

Uncle Bob's full layered architecture (entities → use cases → adapters → frameworks) would be over-engineering for a VS Code extension with 7 modules. The existing pattern — pure transformation modules wired by a single orchestrator — already achieves the key Clean Architecture properties:
- **Dependency rule**: All modules depend inward on types/interfaces, never on each other
- **Testability**: Pure functions with injected dependencies (ConfigurationWriter interface)
- **Single responsibility**: Each module does one thing

We enforce THIS architecture, not a cargo-culted layer structure.

### Linter as AI Agent Guardrail

AI agents read lint errors as feedback. Well-configured lint rules serve as real-time architectural documentation: when an agent tries to import `theme-applier` from `color-generator`, the lint error tells it WHY this is wrong and WHAT to do instead. This is more effective than prose rules alone.

---

## Task 1: Install and Configure ESLint 9 with TypeScript Support

**Files:**
- Create: `eslint.config.mjs`
- Modify: `package.json` (devDependencies + scripts)
- Modify: `.gitignore` (no changes expected, but verify)

**Step 1: Install ESLint dependencies**

Run:
```bash
npm install --save-dev eslint @typescript-eslint/parser @typescript-eslint/eslint-plugin eslint-plugin-import
```

Expected: 4 packages added to devDependencies

**Step 2: Create base ESLint flat config**

Create `eslint.config.mjs`:

```javascript
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';
import importPlugin from 'eslint-plugin-import';

export default [
  {
    ignores: ['dist/**', 'out/**', 'node_modules/**', '*.js', '*.mjs'],
  },
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        project: './tsconfig.json',
        ecmaVersion: 2020,
        sourceType: 'module',
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
      'import': importPlugin,
    },
    rules: {
      // --- Type safety: make `any` hard to use ---
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unsafe-assignment': 'error',
      '@typescript-eslint/no-unsafe-call': 'error',
      '@typescript-eslint/no-unsafe-member-access': 'error',
      '@typescript-eslint/no-unsafe-return': 'error',
      '@typescript-eslint/no-unsafe-argument': 'error',

      // --- Enforce explicit types at module boundaries ---
      '@typescript-eslint/explicit-function-return-type': ['error', {
        allowExpressions: true,
        allowTypedFunctionExpressions: true,
        allowHigherOrderFunctions: true,
      }],
      '@typescript-eslint/explicit-module-boundary-types': 'error',

      // --- Prevent floating promises (common AI agent mistake) ---
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/await-thenable': 'error',

      // --- Code quality ---
      '@typescript-eslint/no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
      }],
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/prefer-readonly': 'error',
      'no-console': 'error',

      // --- Import organization ---
      'import/order': ['error', {
        'groups': [
          'builtin',
          'external',
          'internal',
          'parent',
          'sibling',
          'index',
        ],
        'newlines-between': 'never',
      }],
      'import/no-duplicates': 'error',
      'import/no-cycle': 'error',
    },
  },
  // Test files: relaxed rules
  {
    files: ['src/test/**/*.ts'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        project: './tsconfig.test.json',
        ecmaVersion: 2020,
        sourceType: 'module',
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
      'import': importPlugin,
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      'no-console': 'off',
    },
  },
];
```

**Step 3: Add lint script to package.json**

Add to `"scripts"`:
```json
"lint": "eslint src/",
"lint:fix": "eslint src/ --fix"
```

**Step 4: Run lint to verify configuration works**

Run: `npx eslint src/ --max-warnings 0`
Expected: Lint runs (may have errors — that's fine, we fix them in Task 3)

**Step 5: Commit**

```bash
git add eslint.config.mjs package.json package-lock.json
git commit -m "chore: add ESLint 9 with typescript-eslint and import plugin"
```

---

## Task 2: Add Architectural Boundary Rules

**Files:**
- Modify: `eslint.config.mjs`

This is the key differentiator — these rules enforce the dependency direction rule: **pipeline modules never import each other, only `extension.ts` wires them together.**

**Step 1: Add no-restricted-imports rules to eslint.config.mjs**

Add a new config block specifically for non-orchestrator source files:

```javascript
// --- Architectural boundary: pipeline modules must not import each other ---
{
  files: [
    'src/color-generator.ts',
    'src/worktree-detector.ts',
    'src/config.ts',
    'src/status-bar.ts',
    'src/color-picker.ts',
  ],
  rules: {
    'no-restricted-imports': ['error', {
      patterns: [
        {
          group: ['./*', '!./color-generator'],
          message: 'Pipeline modules must not import each other. Only extension.ts orchestrates the pipeline. If you need a type, define an interface in the consuming module or extract a shared types file.',
        },
      ],
    }],
  },
},
// theme-applier is special: it imports the ColorPalette type from color-generator
{
  files: ['src/theme-applier.ts'],
  rules: {
    'no-restricted-imports': ['error', {
      patterns: [
        {
          group: ['./worktree-detector', './config', './extension', './status-bar', './color-picker'],
          message: 'theme-applier may only import types from color-generator. It must not import other pipeline modules.',
        },
      ],
    }],
  },
},
```

**Step 2: Verify the rules catch violations**

Create a temporary test — add `import { getConfig } from './config';` to `src/color-generator.ts`.

Run: `npx eslint src/color-generator.ts`
Expected: Error about restricted import

Remove the temporary import.

**Step 3: Commit**

```bash
git add eslint.config.mjs
git commit -m "chore: add architectural boundary lint rules for pipeline isolation"
```

---

## Task 3: Fix Existing Lint Violations

**Files:**
- Modify: any `src/*.ts` files that have lint errors

**Step 1: Run full lint and capture violations**

Run: `npx eslint src/ --format compact`
Expected: List of current violations

**Step 2: Fix violations one file at a time**

For each file with violations:
- Add explicit return types where missing
- Replace `any` with proper types
- Fix floating promises with `void` operator or `await`
- Do NOT change behavior — only type annotations and lint compliance

**Step 3: Run lint to verify zero errors**

Run: `npx eslint src/ --max-warnings 0`
Expected: 0 errors, 0 warnings

**Step 4: Run tests to verify no regressions**

Run: `npm test`
Expected: All tests pass

**Step 5: Commit**

```bash
git add src/
git commit -m "chore: fix all existing lint violations"
```

---

## Task 4: Add Pre-Commit Hook with Husky + lint-staged

**Files:**
- Create: `.husky/pre-commit`
- Modify: `package.json` (devDependencies + lint-staged config)

**Step 1: Install husky and lint-staged**

Run:
```bash
npm install --save-dev husky lint-staged
npx husky init
```

**Step 2: Configure pre-commit hook**

Write `.husky/pre-commit`:
```bash
npx lint-staged
```

**Step 3: Add lint-staged config to package.json**

Add to `package.json`:
```json
"lint-staged": {
  "src/**/*.ts": [
    "eslint --max-warnings 0"
  ]
}
```

**Step 4: Test the hook**

Make a deliberate violation (add `any` somewhere), stage it, and attempt to commit.

Run: `git add -A && git commit -m "test hook"`
Expected: Commit blocked by lint error

Revert the change.

**Step 5: Commit**

```bash
git add .husky/ package.json package-lock.json
git commit -m "chore: add pre-commit hook with husky and lint-staged"
```

---

## Task 5: Enhance CLAUDE.md with Architectural Rules

**Files:**
- Modify: `CLAUDE.md`

**Step 1: Add the following sections to CLAUDE.md after "Key Constraints"**

```markdown
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
```

**Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: add architectural rules and lint commands to CLAUDE.md"
```

---

## Task 6: Create Architecture Validation Script

**Files:**
- Create: `.claude/scripts/check-architecture.sh`

The guide recommends executable scripts over prose for critical validations: "Code is deterministic; language interpretation isn't." This script programmatically verifies architectural boundaries so skills can delegate to it.

**Step 1: Create the scripts directory**

Run: `mkdir -p .claude/scripts`

**Step 2: Write the validation script**

Create `.claude/scripts/check-architecture.sh`:

```bash
#!/bin/bash
# Validates architectural rules that ESLint alone cannot catch.
# Called by skills before committing changes.

set -euo pipefail

ERRORS=0

echo "=== Architecture Validation ==="

# 1. Every src/*.ts file (except extension.ts and test/) must have a matching test
echo ""
echo "Checking test coverage for all modules..."
for module in src/*.ts; do
  basename=$(basename "$module" .ts)
  if [ "$basename" = "extension" ]; then continue; fi
  test_file="src/test/unit/${basename}.test.ts"
  if [ ! -f "$test_file" ]; then
    echo "  FAIL: $module has no test file at $test_file"
    ERRORS=$((ERRORS + 1))
  else
    echo "  OK: $module -> $test_file"
  fi
done

# 2. Every module in src/*.ts (except extension.ts) must appear in eslint boundary rules
echo ""
echo "Checking ESLint boundary coverage..."
for module in src/*.ts; do
  basename=$(basename "$module" .ts)
  if [ "$basename" = "extension" ]; then continue; fi
  if ! grep -q "'src/${basename}.ts'" eslint.config.mjs 2>/dev/null && \
     ! grep -q "src/${basename}.ts" eslint.config.mjs 2>/dev/null; then
    echo "  FAIL: $module is not covered by boundary rules in eslint.config.mjs"
    ERRORS=$((ERRORS + 1))
  else
    echo "  OK: $module is covered by boundary rules"
  fi
done

# 3. CLAUDE.md Module Contracts table mentions all modules
echo ""
echo "Checking CLAUDE.md Module Contracts table..."
for module in src/*.ts; do
  basename=$(basename "$module" .ts)
  if ! grep -q "$basename" CLAUDE.md 2>/dev/null; then
    echo "  WARN: $basename not mentioned in CLAUDE.md"
  else
    echo "  OK: $basename documented in CLAUDE.md"
  fi
done

echo ""
if [ $ERRORS -gt 0 ]; then
  echo "FAILED: $ERRORS architecture violation(s) found."
  exit 1
else
  echo "PASSED: All architecture checks passed."
  exit 0
fi
```

**Step 3: Make executable**

Run: `chmod +x .claude/scripts/check-architecture.sh`

**Step 4: Test it**

Run: `bash .claude/scripts/check-architecture.sh`
Expected: All checks pass for existing modules

**Step 5: Commit**

```bash
git add .claude/scripts/
git commit -m "chore: add architecture validation script for skill automation"
```

---

## Task 7: Create New-Pipeline-Module Skill (Proper Folder Structure)

**Files:**
- Create: `.claude/skills/new-pipeline-module/SKILL.md`
- Create: `.claude/skills/new-pipeline-module/references/module-template.md`

Per the [Building Skills for Claude guide](docs/guides/building-skillsfor-claude.md): skills are folders containing `SKILL.md` with YAML frontmatter. The description must include WHAT + WHEN + trigger phrases. Use progressive disclosure — core instructions in `SKILL.md`, detailed templates in `references/`.

**Step 1: Create the skill folder structure**

Run: `mkdir -p .claude/skills/new-pipeline-module/references`

**Step 2: Write the SKILL.md**

Create `.claude/skills/new-pipeline-module/SKILL.md`:

```markdown
---
name: new-pipeline-module
description: Scaffolds a new module in the color pipeline with correct architecture, tests, lint boundaries, and documentation. Use when user says "add a new module", "create a pipeline step", "new feature module", or needs to extend the extension's data pipeline.
metadata:
  author: worktree-colors-theme-3000
  version: 1.0.0
---

# New Pipeline Module

Creates a new module following the project's Pipeline-with-IoC architecture. Ensures dependency boundaries, test coverage, and lint config are all updated.

## Pre-flight Checks

CRITICAL: Before creating anything, verify:
1. The module has a **single responsibility** — one input, one output, one job.
2. It does NOT need to import other pipeline modules (except types via `import type`).
3. Decide: **pure function** (no side effects, preferred) or **effectful module** (needs dependency injection via interface, like `ConfigurationWriter`).

If any check fails, stop and discuss with the user before proceeding.

## Step 1: Define the Module Interface

Create `src/{module-name}.ts`:
- Export an interface for the module's input/output contract
- Export the main function with an **explicit return type**
- Zero imports from sibling pipeline modules (except `import type` for shared types)

Consult `references/module-template.md` for the canonical structure.

## Step 2: Write the Failing Test (TDD)

Create `src/test/unit/{module-name}.test.ts`:
- At least one test per exported function
- For pure functions: use real data, NO mocks
- For effectful modules: define a mock that implements the interface (see `ConfigurationWriter` pattern in `theme-applier.test.ts`)

Run: `npm test`
Expected: FAIL (function not yet implemented)

## Step 3: Implement Minimally

Write just enough code in `src/{module-name}.ts` to make the test pass.

Run: `npm test`
Expected: PASS

## Step 4: Wire Into Pipeline

In `extension.ts` ONLY:
- Import the new module
- Call it at the correct pipeline stage
- Pass results to the next downstream module

No other module should import your new module directly.

## Step 5: Update Architectural Boundaries

In `eslint.config.mjs`:
- Add `'src/{module-name}.ts'` to the pipeline modules `files` array in the `no-restricted-imports` block

Verify: `npx eslint src/{module-name}.ts`
Expected: 0 errors

## Step 6: Update Documentation

In `CLAUDE.md`:
- Add the module to the **Module Contracts** table (Input, Output, Side Effects)
- Update the **architecture diagram** ASCII art

## Step 7: Run Architecture Validation

Run: `bash .claude/scripts/check-architecture.sh`
Expected: PASSED

## Step 8: Final Verification

Run:
```bash
npm run lint && npm test
```

Both must pass with zero errors before committing.

## Troubleshooting

### Error: "Pipeline modules must not import each other"
You imported a sibling module directly. Only `extension.ts` can wire modules. If you need a type, use `import type { ... } from './other-module'`.

### Error: Module not covered by boundary rules
You forgot Step 5. Add the file to the `no-restricted-imports` files array in `eslint.config.mjs`.
```

**Step 3: Write the reference template**

Create `.claude/skills/new-pipeline-module/references/module-template.md`:

```markdown
# Module Template

## Pure Function Module (Preferred)

```typescript
// src/{module-name}.ts

export interface {ModuleName}Input {
	// define typed input
}

export interface {ModuleName}Output {
	// define typed output
}

/** Brief description of what this module does */
export function {functionName}(input: {ModuleName}Input): {ModuleName}Output {
	// Pure transformation — no side effects, no external calls
	// Same input always produces same output
}
```

## Effectful Module (When Side Effects Needed)

```typescript
// src/{module-name}.ts

// Define interface for the external dependency — enables testing via injection
export interface {DependencyName} {
	get<T>(key: string): T | undefined;
	update(key: string, value: unknown, target: number): Thenable<void>;
}

/** Brief description */
export async function {functionName}(
	input: SomeInput,
	dependency: {DependencyName},
	target: number,
): Promise<void> {
	// Side effects go through the injected dependency only
}
```

## Test Template

```typescript
// src/test/unit/{module-name}.test.ts
import * as assert from 'assert';
import { {functionName} } from '../../{module-name}';

suite('{ModuleName}', () => {
	test('should {expected behavior}', () => {
		const result = {functionName}(input);
		assert.strictEqual(result, expected);
	});

	test('should handle edge case', () => {
		const result = {functionName}(edgeInput);
		assert.strictEqual(result, edgeExpected);
	});
});
```
```

**Step 4: Commit**

```bash
git add .claude/skills/new-pipeline-module/
git commit -m "chore: add new-pipeline-module skill with SKILL.md and reference template"
```

---

## Task 8: Create Safe-Refactor Skill (Proper Folder Structure)

**Files:**
- Create: `.claude/skills/safe-refactor/SKILL.md`

**Step 1: Create the skill folder**

Run: `mkdir -p .claude/skills/safe-refactor`

**Step 2: Write the SKILL.md**

Create `.claude/skills/safe-refactor/SKILL.md`:

```markdown
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
```

**Step 3: Commit**

```bash
git add .claude/skills/safe-refactor/
git commit -m "chore: add safe-refactor skill with SKILL.md"
```

---

## Task 9: Create Pre-Commit Validation Skill

**Files:**
- Create: `.claude/skills/pre-commit-check/SKILL.md`

This skill teaches agents what to do BEFORE committing — the final gate that ensures quality.

**Step 1: Create the skill folder**

Run: `mkdir -p .claude/skills/pre-commit-check`

**Step 2: Write the SKILL.md**

Create `.claude/skills/pre-commit-check/SKILL.md`:

```markdown
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
```

**Step 3: Commit**

```bash
git add .claude/skills/pre-commit-check/
git commit -m "chore: add pre-commit-check skill for AI agents"
```

---

## Task 10: Add Complexity and Size Lint Rules

**Files:**
- Modify: `eslint.config.mjs`

These rules prevent AI agents from generating oversized or overly complex functions — a common failure mode.

**Step 1: Add complexity rules to the base config**

Add these rules to the main source files config block:

```javascript
// --- Complexity limits: prevent AI-generated sprawl ---
'max-lines-per-function': ['warn', { max: 50, skipBlankLines: true, skipComments: true }],
'max-params': ['warn', { max: 4 }],
'complexity': ['warn', { max: 10 }],
'max-depth': ['warn', { max: 3 }],
```

**Step 2: Run lint and check for new warnings**

Run: `npx eslint src/ --format compact`
Expected: May produce warnings (not errors) for existing code. Review each — if existing code legitimately exceeds limits, add inline `// eslint-disable-next-line` with a justification comment.

**Step 3: Commit**

```bash
git add eslint.config.mjs
git commit -m "chore: add complexity and size lint rules to prevent sprawl"
```

---

## Task 11: Final Verification

**Files:** None (verification only)

**Step 1: Run full lint**

Run: `npx eslint src/ --max-warnings 0`
Expected: 0 errors, 0 warnings (or only justified inline disables)

**Step 2: Run full test suite**

Run: `npm test`
Expected: All tests pass

**Step 3: Test architectural boundary enforcement**

Temporarily add to `src/config.ts`:
```typescript
import { hashString } from './color-generator';
```

Run: `npx eslint src/config.ts`
Expected: Error about restricted import

Remove the temporary import.

**Step 4: Test pre-commit hook**

Add `const x: any = 5;` to `src/config.ts`, stage, and try to commit.
Expected: Commit blocked

Revert.

**Step 5: Verify the full system**

Run:
```bash
npm run lint && npm test && echo "All checks pass"
```
Expected: `All checks pass`

---

## Summary of What Gets Enforced

| Rule Category | Enforcement Layer | What It Catches |
|---|---|---|
| No cross-module imports | ESLint `no-restricted-imports` | AI agent wiring modules directly instead of through orchestrator |
| No circular dependencies | ESLint `import/no-cycle` | Accidental coupling between modules |
| No `any` | `@typescript-eslint/no-explicit-any` + unsafe rules | AI agents taking type shortcuts |
| Explicit return types | `@typescript-eslint/explicit-function-return-type` | Missing contracts at module boundaries |
| No floating promises | `@typescript-eslint/no-floating-promises` | Unhandled async (common AI mistake) |
| Function size limits | `max-lines-per-function`, `complexity` | AI-generated monolithic functions |
| Parameter count limits | `max-params` | Functions that do too much |
| Import order | `import/order` | Consistent, readable imports |
| Pre-commit gate | Husky + lint-staged | Nothing ships without passing lint |
| Architectural rules in CLAUDE.md | AI agent context | Agents understand WHY before they code |
| Architecture validation script | `.claude/scripts/check-architecture.sh` | Programmatic checks that prose cannot enforce (test coverage, boundary config, docs) |
| New-module skill | `.claude/skills/new-pipeline-module/SKILL.md` | Agents follow correct TDD + boundary procedure for adding modules |
| Safe-refactor skill | `.claude/skills/safe-refactor/SKILL.md` | Agents verify before/after equivalence when restructuring |
| Pre-commit-check skill | `.claude/skills/pre-commit-check/SKILL.md` | Agents run all quality gates before any commit |

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

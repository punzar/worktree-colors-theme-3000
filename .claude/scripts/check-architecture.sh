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

# Better Color Distribution via Bit-Mixing Finalizer — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix visually similar color assignments for worktrees by adding a Murmur3-style bit-mixing finalizer to the hash-to-hue pipeline.

**Architecture:** Insert a pure `mixBits()` function between the existing FNV-1a hash and the `% 360` modulo in `color-generator.ts`. This ensures all output bits depend on all input bits, spreading similar short-string hashes across the full hue circle. No new modules, no contract changes — the pipeline signature is unchanged.

**Tech Stack:** TypeScript, Node.js assert (tests), esbuild (build)

---

## Problem

The extension assigns visually similar colors to different worktrees. Root cause: `hashString(identifier) % 360` in `src/color-generator.ts:75`.

1. **Poor avalanche in FNV-1a for short strings.** Worktree folder names (5-20 chars) produce hashes where similar names like `feature-auth` and `feature-api` land in nearby hue ranges.
2. **Modular bias from `% 360`.** `2^32 / 360` is not an integer — hues 0-255 each get one extra pre-image vs hues 256-359. Minor but compounds with issue #1.

## Solution

A Murmur3-style bit-mixing finalizer — three rounds of XOR-shift + multiply. Well-known technique (Java `HashMap`, Murmur3, xxHash). 5 lines of code, no dependencies, deterministic.

## Scope

| File | Change |
|------|--------|
| `src/color-generator.ts` | Add `mixBits()`, call it in `generatePalette` |
| `src/test/unit/color-generator.test.ts` | Add 3 new tests, update 1 existing assertion |

**Files NOT changed:** `worktree-detector.ts`, `config.ts`, `extension.ts`, `theme-applier.ts`

## Trade-offs

**Pros:** 5 LOC, no deps, deterministic, no contract change, mathematically guaranteed bit distribution.

**Cons:** One-time hue shift for all existing worktrees. Does not guarantee minimum perceptual distance for N specific worktrees (but clustering is statistically very unlikely with good mixing).

---

## Tasks

### Task 1: Write failing test — `mixBits` distributes similar names

**Files:**
- Modify: `src/test/unit/color-generator.test.ts:128` (append before closing `});`)

**Step 1: Write the failing test**

Add this test at the end of the suite (before the closing `});`):

```typescript
test('mixBits distributes similar worktree names at least 15 degrees apart', () => {
	const names = [
		'feature-api', 'staging-2', 'feature-settings',
		'hotfix-css', 'feature-payments', 'feature-dashboard',
		'staging', 'ci-pipeline', 'develop', 'feature-ui',
	];
	const hues = names.map(n => mixBits(hashString(n)) % 360);
	hues.sort((a, b) => a - b);

	for (let i = 1; i < hues.length; i++) {
		const gap = hues[i] - hues[i - 1];
		assert.ok(gap >= 15, `Hues too close: ${hues[i - 1]} and ${hues[i]} (gap=${gap}) for sorted names`);
	}
	// Also check wrap-around gap
	const wrapGap = 360 - hues[hues.length - 1] + hues[0];
	assert.ok(wrapGap >= 15, `Wrap-around gap too small: ${wrapGap}`);
});
```

Also update the import on line 2 to include `mixBits`:

```typescript
import { generatePalette, hashString, hslToHex, contrastForeground, hexToHue, mixBits } from '../../color-generator';
```

**Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `mixBits` is not exported from `color-generator.ts`

**Step 3: Commit the failing test**

```bash
git add src/test/unit/color-generator.test.ts
git commit -m "test: add failing test for mixBits hue distribution"
```

---

### Task 2: Write failing test — `mixBits` determinism

**Files:**
- Modify: `src/test/unit/color-generator.test.ts` (append to suite)

**Step 1: Write the failing test**

```typescript
test('mixBits is deterministic', () => {
	const inputs = ['feature-auth', 'main', 'hotfix-css', 'a', 'abcdefghijklmnop'];
	for (const input of inputs) {
		const hash = hashString(input);
		assert.strictEqual(mixBits(hash), mixBits(hash), `mixBits not deterministic for "${input}"`);
	}
});
```

**Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `mixBits` still not defined

**Step 3: Commit the failing test**

```bash
git add src/test/unit/color-generator.test.ts
git commit -m "test: add failing test for mixBits determinism"
```

---

### Task 3: Write failing test — full-range hue coverage

**Files:**
- Modify: `src/test/unit/color-generator.test.ts` (append to suite)

**Step 1: Write the failing test**

```typescript
test('mixBits produces hues spanning at least 300 of 360 degrees', () => {
	const seen = new Set<number>();
	for (let i = 0; i < 100; i++) {
		const name = `worktree-${i}-${String.fromCharCode(97 + (i % 26))}`;
		const hue = mixBits(hashString(name)) % 360;
		seen.add(Math.floor(hue));
	}
	const min = Math.min(...seen);
	const max = Math.max(...seen);
	const span = max - min;
	assert.ok(span >= 300, `Hue span only ${span} degrees (${min}-${max}), expected >= 300`);
});
```

**Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `mixBits` still not defined

**Step 3: Commit the failing test**

```bash
git add src/test/unit/color-generator.test.ts
git commit -m "test: add failing test for mixBits full-range coverage"
```

---

### Task 4: Implement `mixBits` and integrate into `generatePalette`

**Files:**
- Modify: `src/color-generator.ts:18` (after `hashString`) and `src/color-generator.ts:75` (in `generatePalette`)

**Step 1: Add `mixBits` function after `hashString` (after line 18)**

```typescript
/** Murmur3-style bit-mixing finalizer — ensures all output bits depend on all input bits */
export function mixBits(h: number): number {
	h = ((h >> 16) ^ h) * 0x85ebca6b >>> 0;
	h = ((h >> 16) ^ h) * 0xc2b2ae35 >>> 0;
	h = (h >> 16) ^ h;
	return h >>> 0;
}
```

**Step 2: Update `generatePalette` to use `mixBits`**

Change line 75 from:

```typescript
const hue = config.hueOverride ?? hash % 360;
```

to:

```typescript
const hue = config.hueOverride ?? mixBits(hash) % 360;
```

**Step 3: Run tests to verify the 3 new tests pass**

Run: `npm test`
Expected: PASS for all three new `mixBits` tests

**Step 4: Commit**

```bash
git add src/color-generator.ts
git commit -m "feat: add mixBits finalizer for better hue distribution"
```

---

### Task 5: Update existing test assertion for hash-based comparison

**Files:**
- Modify: `src/test/unit/color-generator.test.ts:118-127`

**Step 1: Update the assertion**

The test `generatePalette with hueOverride produces different colors than hash-based` on line 123 computes `hashString('test-worktree') % 360`. Update it to use `mixBits`:

Change:

```typescript
const hashHue = hashString('test-worktree') % 360;
```

to:

```typescript
const hashHue = mixBits(hashString('test-worktree')) % 360;
```

**Step 2: Run all tests**

Run: `npm test`
Expected: ALL PASS

**Step 3: Commit**

```bash
git add src/test/unit/color-generator.test.ts
git commit -m "test: update hash assertion to use mixBits"
```

---

### Task 6: Run lint and final verification

**Step 1: Run lint**

Run: `npm run lint`
Expected: No errors

**Step 2: Run full compile**

Run: `npm run compile`
Expected: No errors

**Step 3: Run full test suite one more time**

Run: `npm test`
Expected: ALL PASS

**Step 4: If all green, use `superpowers:finishing-a-development-branch` to complete the branch**

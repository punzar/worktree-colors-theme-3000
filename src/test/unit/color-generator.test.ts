import * as assert from 'assert';
import { generatePalette, hashString, hslToHex, contrastForeground, hexToHue, mixBits } from '../../color-generator';

// eslint-disable-next-line max-lines-per-function
suite('Color Generator', () => {
	test('hashString returns a consistent number for the same input', () => {
		const h1 = hashString('feature-branch');
		const h2 = hashString('feature-branch');
		assert.strictEqual(h1, h2);
	});

	test('hashString returns different numbers for different inputs', () => {
		const h1 = hashString('feature-branch');
		const h2 = hashString('bugfix-branch');
		assert.notStrictEqual(h1, h2);
	});

	test('hslToHex returns a valid 7-char hex color', () => {
		const hex = hslToHex(200, 0.5, 0.3);
		assert.match(hex, /^#[0-9a-f]{6}$/);
	});

	test('hslToHex handles edge hue values', () => {
		assert.match(hslToHex(0, 0.5, 0.5), /^#[0-9a-f]{6}$/);
		assert.match(hslToHex(360, 0.5, 0.5), /^#[0-9a-f]{6}$/);
	});

	test('contrastForeground returns light color for dark background', () => {
		const fg = contrastForeground('#1a1a2e');
		// Should be a light color — check lightness by parsing
		assert.match(fg, /^#[0-9a-f]{6}$/);
		// Dark background → light foreground (R+G+B should be high)
		const r = parseInt(fg.slice(1, 3), 16);
		const g = parseInt(fg.slice(3, 5), 16);
		const b = parseInt(fg.slice(5, 7), 16);
		assert.ok(r + g + b > 384, `Expected light foreground, got ${fg}`);
	});

	test('contrastForeground returns dark color for light background', () => {
		const fg = contrastForeground('#f0f0f0');
		const r = parseInt(fg.slice(1, 3), 16);
		const g = parseInt(fg.slice(3, 5), 16);
		const b = parseInt(fg.slice(5, 7), 16);
		assert.ok(r + g + b < 384, `Expected dark foreground, got ${fg}`);
	});

	test('generatePalette returns a valid palette with all required keys', () => {
		const palette = generatePalette('my-worktree', { saturation: 0.4, lightness: 0.3, isDark: true });
		const requiredKeys = [
			'titleBar.activeBackground',
			'titleBar.activeForeground',
			'titleBar.inactiveBackground',
			'titleBar.inactiveForeground',
			'activityBar.background',
			'statusBar.background',
			'statusBar.foreground',
		];
		for (const key of requiredKeys) {
			assert.ok(palette[key], `Missing key: ${key}`);
			assert.match(palette[key], /^#[0-9a-f]{6}$/, `Invalid hex for ${key}: ${palette[key]}`);
		}
	});

	test('generatePalette is deterministic', () => {
		const config = { saturation: 0.4, lightness: 0.3, isDark: true };
		const p1 = generatePalette('test-worktree', config);
		const p2 = generatePalette('test-worktree', config);
		assert.deepStrictEqual(p1, p2);
	});

	test('generatePalette produces different hues for different identifiers', () => {
		const config = { saturation: 0.4, lightness: 0.3, isDark: true };
		const p1 = generatePalette('worktree-alpha', config);
		const p2 = generatePalette('worktree-beta', config);
		assert.notStrictEqual(p1['titleBar.activeBackground'], p2['titleBar.activeBackground']);
	});

	test('generatePalette respects saturation and lightness parameters', () => {
		const dark = generatePalette('test', { saturation: 0.4, lightness: 0.2, isDark: true });
		const light = generatePalette('test', { saturation: 0.4, lightness: 0.8, isDark: false });
		// Different lightness → different colors
		assert.notStrictEqual(dark['titleBar.activeBackground'], light['titleBar.activeBackground']);
	});

	test('generatePalette adjusts for light vs dark theme', () => {
		const dark = generatePalette('branch', { saturation: 0.4, lightness: 0.3, isDark: true });
		const light = generatePalette('branch', { saturation: 0.4, lightness: 0.85, isDark: false });
		assert.notStrictEqual(dark['titleBar.activeBackground'], light['titleBar.activeBackground']);
	});

	test('hexToHue extracts hue from a red hex color', () => {
		const hue = hexToHue('#ff0000');
		assert.ok(hue >= 0 && hue < 1, `Expected hue near 0, got ${hue}`);
	});

	test('hexToHue extracts hue from a blue hex color', () => {
		const hue = hexToHue('#0000ff');
		assert.ok(hue > 0.6 && hue < 0.7, `Expected hue near 0.667, got ${hue}`);
	});

	test('hexToHue extracts hue from a green hex color', () => {
		const hue = hexToHue('#00ff00');
		assert.ok(hue > 0.3 && hue < 0.4, `Expected hue near 0.333, got ${hue}`);
	});

	test('hexToHue returns 0 for grayscale colors', () => {
		assert.strictEqual(hexToHue('#808080'), 0);
		assert.strictEqual(hexToHue('#000000'), 0);
		assert.strictEqual(hexToHue('#ffffff'), 0);
	});

	test('generatePalette uses hueOverride when provided', () => {
		const config = { saturation: 0.4, lightness: 0.3, isDark: true, hueOverride: 200 };
		const p1 = generatePalette('ignored-identifier', config);
		const p2 = generatePalette('different-identifier', config);
		assert.deepStrictEqual(p1, p2);
	});

	test('generatePalette with hueOverride produces different colors than hash-based', () => {
		const base = { saturation: 0.4, lightness: 0.3, isDark: true };
		const withOverride = { ...base, hueOverride: 200 };
		const hashBased = generatePalette('test-worktree', base);
		const overridden = generatePalette('test-worktree', withOverride);
		const hashHue = mixBits(hashString('test-worktree')) % 360;
		if (hashHue !== 200) {
			assert.notStrictEqual(hashBased['titleBar.activeBackground'], overridden['titleBar.activeBackground']);
		}
	});

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

	test('mixBits is deterministic', () => {
		const inputs = ['feature-auth', 'main', 'hotfix-css', 'a', 'abcdefghijklmnop'];
		for (const input of inputs) {
			const hash = hashString(input);
			assert.strictEqual(mixBits(hash), mixBits(hash), `mixBits not deterministic for "${input}"`);
		}
	});

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
});

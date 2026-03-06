import * as assert from 'assert';
import { generatePalette, hashString, hslToHex, contrastForeground } from '../../color-generator';

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
});

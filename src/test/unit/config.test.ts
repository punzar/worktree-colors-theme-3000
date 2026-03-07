import * as assert from 'assert';
import { getConfig, DEFAULTS } from '../../config';

suite('Config', () => {
	test('returns default values when no config is provided', () => {
		const config = getConfig();
		assert.deepStrictEqual(config, DEFAULTS);
	});

	test('returns default values when config returns undefined', () => {
		const config = getConfig({ get: () => undefined });
		assert.deepStrictEqual(config, DEFAULTS);
	});

	test('reads saturation from configuration', () => {
		const config = getConfig({
			get: <T>(key: string): T | undefined => {
				if (key === 'saturation') { return 0.7 as T; }
				return undefined;
			}
		});
		assert.strictEqual(config.saturation, 0.7);
	});

	test('reads lightness values from configuration', () => {
		const config = getConfig({
			get: <T>(key: string): T | undefined => {
				if (key === 'lightness') { return 0.25 as T; }
				if (key === 'lightnessLight') { return 0.9 as T; }
				return undefined;
			}
		});
		assert.strictEqual(config.lightness, 0.25);
		assert.strictEqual(config.lightnessLight, 0.9);
	});

	test('reads colorTargets from configuration', () => {
		const targets = ['titleBar', 'statusBar'];
		const config = getConfig({
			get: <T>(key: string): T | undefined => {
				if (key === 'colorTargets') { return targets as T; }
				return undefined;
			}
		});
		assert.deepStrictEqual(config.colorTargets, targets);
	});

	test('reads colorizeNonWorktree from configuration', () => {
		const config = getConfig({
			get: <T>(key: string): T | undefined => {
				if (key === 'colorizeNonWorktree') { return true as T; }
				return undefined;
			}
		});
		assert.strictEqual(config.colorizeNonWorktree, true);
	});

	test('reads enabled from configuration', () => {
		const config = getConfig({
			get: <T>(key: string): T | undefined => {
				if (key === 'enabled') { return false as T; }
				return undefined;
			}
		});
		assert.strictEqual(config.enabled, false);
	});

	test('reads customColors from configuration', () => {
		const customColors = { 'feature-branch': '#ff0000', 'main-repo': '#00ff00' };
		const config = getConfig({
			get: <T>(key: string): T | undefined => {
				if (key === 'customColors') { return customColors as T; }
				return undefined;
			}
		});
		assert.deepStrictEqual(config.customColors, customColors);
	});

	test('returns empty object for customColors when not configured', () => {
		const config = getConfig({ get: () => undefined });
		assert.deepStrictEqual(config.customColors, {});
	});
});

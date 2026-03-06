import * as assert from 'assert';
import { applyColors, resetColors, ConfigurationWriter } from '../../theme-applier';
import { ColorPalette } from '../../color-generator';

function createMockConfig(initial: Record<string, string> = {}): ConfigurationWriter & { lastUpdate: { key: string; value: unknown; target: number } | null } {
	let store: Record<string, unknown> = { colorCustomizations: { ...initial } };
	const mock = {
		lastUpdate: null as { key: string; value: unknown; target: number } | null,
		get<T>(key: string): T | undefined {
			return store[key] as T | undefined;
		},
		async update(key: string, value: unknown, target: number): Promise<void> {
			store[key] = value;
			mock.lastUpdate = { key, value, target };
		},
	};
	return mock;
}

const SAMPLE_PALETTE: ColorPalette = {
	'titleBar.activeBackground': '#2a1f3d',
	'titleBar.activeForeground': '#e0e0e0',
	'titleBar.inactiveBackground': '#1f1a2e',
	'titleBar.inactiveForeground': '#e0e0e0',
	'activityBar.background': '#2d1f3d',
	'statusBar.background': '#312040',
	'statusBar.foreground': '#e0e0e0',
};

suite('Theme Applier', () => {
	test('applies color palette to workbench.colorCustomizations', async () => {
		const config = createMockConfig();
		await applyColors(SAMPLE_PALETTE, ['titleBar', 'activityBar', 'statusBar'], config, 2);

		assert.ok(config.lastUpdate);
		assert.strictEqual(config.lastUpdate!.key, 'colorCustomizations');
		const colors = config.lastUpdate!.value as Record<string, string>;
		assert.strictEqual(colors['titleBar.activeBackground'], '#2a1f3d');
		assert.strictEqual(colors['statusBar.background'], '#312040');
	});

	test('merges with existing user color customizations', async () => {
		const config = createMockConfig({ 'editor.background': '#000000' });
		await applyColors(SAMPLE_PALETTE, ['titleBar'], config, 2);

		const colors = config.lastUpdate!.value as Record<string, string>;
		assert.strictEqual(colors['editor.background'], '#000000', 'Should preserve user color');
		assert.strictEqual(colors['titleBar.activeBackground'], '#2a1f3d', 'Should add worktree color');
	});

	test('only sets keys for configured color targets', async () => {
		const config = createMockConfig();
		await applyColors(SAMPLE_PALETTE, ['titleBar'], config, 2);

		const colors = config.lastUpdate!.value as Record<string, string>;
		assert.strictEqual(colors['titleBar.activeBackground'], '#2a1f3d');
		assert.strictEqual(colors['activityBar.background'], undefined, 'Should not set unconfigured target');
		assert.strictEqual(colors['statusBar.background'], undefined, 'Should not set unconfigured target');
	});

	test('reset removes only worktree-managed keys', async () => {
		const config = createMockConfig({
			'titleBar.activeBackground': '#2a1f3d',
			'titleBar.activeForeground': '#e0e0e0',
			'editor.background': '#000000',
		});
		await resetColors(['titleBar'], config, 2);

		const colors = config.lastUpdate!.value as Record<string, string>;
		assert.strictEqual(colors['titleBar.activeBackground'], undefined, 'Should remove managed key');
		assert.strictEqual(colors['editor.background'], '#000000', 'Should preserve user key');
	});

	test('reset preserves user-set color customizations', async () => {
		const config = createMockConfig({
			'titleBar.activeBackground': '#2a1f3d',
			'statusBar.background': '#312040',
			'editor.foreground': '#ffffff',
			'sideBar.background': '#111111',
		});
		await resetColors(['titleBar', 'activityBar', 'statusBar'], config, 2);

		const colors = config.lastUpdate!.value as Record<string, string>;
		assert.strictEqual(colors['editor.foreground'], '#ffffff');
		assert.strictEqual(colors['sideBar.background'], '#111111');
		assert.strictEqual(colors['titleBar.activeBackground'], undefined);
		assert.strictEqual(colors['statusBar.background'], undefined);
	});
});

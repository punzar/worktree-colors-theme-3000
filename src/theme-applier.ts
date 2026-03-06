import type { ColorPalette } from './color-generator';

export interface ConfigurationWriter {
	get<T>(key: string): T | undefined;
	update(key: string, value: unknown, target: number): Thenable<void>;
}

// Maps target names to the palette keys they control
const TARGET_KEY_MAP: Record<string, string[]> = {
	titleBar: [
		'titleBar.activeBackground',
		'titleBar.activeForeground',
		'titleBar.inactiveBackground',
		'titleBar.inactiveForeground',
	],
	activityBar: [
		'activityBar.background',
	],
	statusBar: [
		'statusBar.background',
		'statusBar.foreground',
	],
};

/** All palette keys managed by this extension */
export function getManagedKeys(targets: string[]): string[] {
	const keys: string[] = [];
	for (const target of targets) {
		const mapped = TARGET_KEY_MAP[target];
		if (mapped) {
			keys.push(...mapped);
		}
	}
	return keys;
}

export async function applyColors(
	palette: ColorPalette,
	targets: string[],
	config: ConfigurationWriter,
	configTarget: number,
): Promise<void> {
	const current = config.get<Record<string, string>>('colorCustomizations') ?? {};
	const managedKeys = getManagedKeys(targets);

	const updated = { ...current };
	for (const key of managedKeys) {
		if (palette[key]) {
			updated[key] = palette[key];
		}
	}

	await config.update('colorCustomizations', updated, configTarget);
}

export async function resetColors(
	targets: string[],
	config: ConfigurationWriter,
	configTarget: number,
): Promise<void> {
	const current = config.get<Record<string, string>>('colorCustomizations') ?? {};
	const managedKeys = new Set(getManagedKeys(targets));

	const updated: Record<string, string> = {};
	for (const [key, value] of Object.entries(current)) {
		if (!managedKeys.has(key)) {
			updated[key] = value;
		}
	}

	await config.update(
		'colorCustomizations',
		Object.keys(updated).length > 0 ? updated : undefined,
		configTarget,
	);
}

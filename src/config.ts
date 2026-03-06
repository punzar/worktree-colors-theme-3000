export interface WorktreeColorsConfig {
	enabled: boolean;
	saturation: number;
	lightness: number;
	lightnessLight: number;
	colorizeNonWorktree: boolean;
	colorTargets: string[];
}

export const DEFAULTS: WorktreeColorsConfig = {
	enabled: true,
	saturation: 0.4,
	lightness: 0.3,
	lightnessLight: 0.85,
	colorizeNonWorktree: false,
	colorTargets: ['titleBar', 'activityBar', 'statusBar'],
};

export function getConfig(vsConfig?: { get<T>(key: string): T | undefined }): WorktreeColorsConfig {
	if (!vsConfig) {
		return { ...DEFAULTS };
	}

	return {
		enabled: vsConfig.get<boolean>('enabled') ?? DEFAULTS.enabled,
		saturation: vsConfig.get<number>('saturation') ?? DEFAULTS.saturation,
		lightness: vsConfig.get<number>('lightness') ?? DEFAULTS.lightness,
		lightnessLight: vsConfig.get<number>('lightnessLight') ?? DEFAULTS.lightnessLight,
		colorizeNonWorktree: vsConfig.get<boolean>('colorizeNonWorktree') ?? DEFAULTS.colorizeNonWorktree,
		colorTargets: vsConfig.get<string[]>('colorTargets') ?? DEFAULTS.colorTargets,
	};
}

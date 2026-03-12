export interface ColorConfig {
	saturation: number;
	lightness: number;
	isDark: boolean;
	hueOverride?: number;
}

export type ColorPalette = Record<string, string>;

/** FNV-1a hash */
export function hashString(input: string): number {
	let hash = 2166136261;
	for (let i = 0; i < input.length; i++) {
		hash ^= input.charCodeAt(i);
		hash = (hash * 16777619) >>> 0;
	}
	return hash;
}

/** Murmur3-style bit-mixing finalizer — ensures all output bits depend on all input bits */
export function mixBits(h: number): number {
	h = ((h >> 16) ^ h) * 0x85ebca6b >>> 0;
	h = ((h >> 16) ^ h) * 0xc2b2ae35 >>> 0;
	h = (h >> 16) ^ h;
	return h >>> 0;
}

/** Convert HSL (h: 0-360, s: 0-1, l: 0-1) to hex color */
export function hslToHex(h: number, s: number, l: number): string {
	h = ((h % 360) + 360) % 360;
	const c = (1 - Math.abs(2 * l - 1)) * s;
	const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
	const m = l - c / 2;

	let r = 0, g = 0, b = 0;
	if (h < 60)       { r = c; g = x; b = 0; }
	else if (h < 120) { r = x; g = c; b = 0; }
	else if (h < 180) { r = 0; g = c; b = x; }
	else if (h < 240) { r = 0; g = x; b = c; }
	else if (h < 300) { r = x; g = 0; b = c; }
	else              { r = c; g = 0; b = x; }

	const toHex = (v: number): string => Math.round((v + m) * 255).toString(16).padStart(2, '0');
	return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/** Return a light or dark foreground based on background luminance */
export function contrastForeground(bgHex: string): string {
	const r = parseInt(bgHex.slice(1, 3), 16) / 255;
	const g = parseInt(bgHex.slice(3, 5), 16) / 255;
	const b = parseInt(bgHex.slice(5, 7), 16) / 255;

	// Relative luminance (sRGB)
	const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
	return luminance > 0.4 ? '#1e1e1e' : '#e0e0e0';
}

/** Extract hue (0-1 range) from a hex color string */
export function hexToHue(hex: string): number {
	const r = parseInt(hex.slice(1, 3), 16) / 255;
	const g = parseInt(hex.slice(3, 5), 16) / 255;
	const b = parseInt(hex.slice(5, 7), 16) / 255;

	const max = Math.max(r, g, b);
	const min = Math.min(r, g, b);
	const delta = max - min;

	if (delta === 0) { return 0; }

	let h: number;
	if (max === r) { h = ((g - b) / delta) % 6; }
	else if (max === g) { h = (b - r) / delta + 2; }
	else { h = (r - g) / delta + 4; }

	h /= 6;
	if (h < 0) { h += 1; }
	return h;
}

/** Generate a full color palette from a worktree identifier and config */
export function generatePalette(identifier: string, config: ColorConfig): ColorPalette {
	const hash = hashString(identifier);
	const hue = config.hueOverride ?? mixBits(hash) % 360;
	const { saturation, lightness } = config;

	const titleBg = hslToHex(hue, saturation, lightness);
	const titleFg = contrastForeground(titleBg);

	// Slightly desaturated for inactive title bar
	const inactiveBg = hslToHex(hue, saturation * 0.6, lightness);
	const inactiveFg = contrastForeground(inactiveBg);

	// Activity bar: slight hue offset
	const activityBg = hslToHex(hue + 15, saturation, lightness);

	// Status bar: complementary shift
	const statusBg = hslToHex(hue + 30, saturation, lightness);
	const statusFg = contrastForeground(statusBg);

	return {
		'titleBar.activeBackground': titleBg,
		'titleBar.activeForeground': titleFg,
		'titleBar.inactiveBackground': inactiveBg,
		'titleBar.inactiveForeground': inactiveFg,
		'activityBar.background': activityBg,
		'statusBar.background': statusBg,
		'statusBar.foreground': statusFg,
	};
}

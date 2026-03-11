/** Validate a hex color string. Returns null if valid, error message if invalid. */
export function validateHexColor(input: string): string | null {
	if (/^#[0-9a-fA-F]{6}$/.test(input)) {
		return null;
	}
	return 'Enter a valid hex color (e.g. #ff0000)';
}

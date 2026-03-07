import * as assert from 'assert';
import { validateHexColor } from '../../color-picker';

suite('Color Picker', () => {
	test('accepts valid 6-digit hex color', () => {
		assert.strictEqual(validateHexColor('#ff0000'), null);
		assert.strictEqual(validateHexColor('#00ff00'), null);
		assert.strictEqual(validateHexColor('#1a2b3c'), null);
	});

	test('accepts uppercase hex color', () => {
		assert.strictEqual(validateHexColor('#FF0000'), null);
		assert.strictEqual(validateHexColor('#AABBCC'), null);
	});

	test('rejects missing hash', () => {
		const result = validateHexColor('ff0000');
		assert.ok(result !== null, 'Should reject color without #');
	});

	test('rejects wrong length', () => {
		assert.ok(validateHexColor('#fff') !== null, 'Should reject 3-digit hex');
		assert.ok(validateHexColor('#ff00000') !== null, 'Should reject 7-digit hex');
	});

	test('rejects invalid characters', () => {
		assert.ok(validateHexColor('#gggggg') !== null, 'Should reject non-hex chars');
		assert.ok(validateHexColor('#zzzzzz') !== null, 'Should reject non-hex chars');
	});

	test('rejects empty string', () => {
		assert.ok(validateHexColor('') !== null, 'Should reject empty string');
	});
});

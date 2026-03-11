import * as assert from 'assert';
import { formatStatusBarText } from '../../status-bar';

suite('Status Bar', () => {
	test('formats text with worktree identifier', () => {
		const text = formatStatusBarText('feature-branch');
		assert.ok(text.includes('feature-branch'), `Expected text to include identifier, got: ${text}`);
	});

	test('formats text with non-worktree identifier', () => {
		const text = formatStatusBarText('my-project');
		assert.ok(text.includes('my-project'), `Expected text to include identifier, got: ${text}`);
	});

	test('includes palette icon', () => {
		const text = formatStatusBarText('feature-branch');
		assert.ok(text.includes('$(symbol-color)'), `Expected palette icon in text, got: ${text}`);
	});
});

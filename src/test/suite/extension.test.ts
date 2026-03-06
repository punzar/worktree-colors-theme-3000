import * as assert from 'assert';
import * as vscode from 'vscode';

suite('Extension', () => {
	test('activates without error', async () => {
		const ext = vscode.extensions.getExtension('punzar.worktree-colors-theme-3000');
		assert.ok(ext, 'Extension should be found');
	});
});

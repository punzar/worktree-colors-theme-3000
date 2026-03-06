import * as assert from 'assert';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { execSync } from 'child_process';
import { detectWorktree, WorktreeInfo } from '../../worktree-detector';

suite('Worktree Detector', () => {
	let tmpDir: string;
	let mainRepoDir: string;
	let worktreeDir: string;

	setup(() => {
		tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wt-test-'));
		mainRepoDir = path.join(tmpDir, 'main-repo');
		worktreeDir = path.join(tmpDir, 'feature-branch');

		// Create a git repo with an initial commit
		fs.mkdirSync(mainRepoDir);
		execSync('git init && git commit --allow-empty -m "init"', { cwd: mainRepoDir });

		// Create a worktree
		execSync('git branch feature-branch', { cwd: mainRepoDir });
		execSync(`git worktree add "${worktreeDir}" feature-branch`, { cwd: mainRepoDir });
	});

	teardown(() => {
		// Clean up worktree before removing directory
		try {
			execSync(`git worktree remove "${worktreeDir}" --force`, { cwd: mainRepoDir });
		} catch {
			// ignore
		}
		fs.rmSync(tmpDir, { recursive: true, force: true });
	});

	test('returns worktree info when inside a git worktree', async () => {
		const info = await detectWorktree(worktreeDir);
		assert.ok(info, 'Should detect worktree');
		assert.strictEqual(info!.isWorktree, true);
		assert.ok(info!.identifier.length > 0, 'Should have an identifier');
	});

	test('extracts worktree name from path', async () => {
		const info = await detectWorktree(worktreeDir);
		assert.ok(info);
		assert.ok(info!.identifier.includes('feature-branch'), `Expected identifier to include worktree name, got: ${info!.identifier}`);
	});

	test('returns non-worktree info for a regular git repo', async () => {
		const info = await detectWorktree(mainRepoDir);
		assert.ok(info, 'Should detect git repo');
		assert.strictEqual(info!.isWorktree, false);
	});

	test('returns null when not inside a git repo', async () => {
		const nonGitDir = path.join(tmpDir, 'no-git');
		fs.mkdirSync(nonGitDir);
		const info = await detectWorktree(nonGitDir);
		assert.strictEqual(info, null);
	});

	test('handles git command failures gracefully', async () => {
		const info = await detectWorktree('/nonexistent/path');
		assert.strictEqual(info, null);
	});
});

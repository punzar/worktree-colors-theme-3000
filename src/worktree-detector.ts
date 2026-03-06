import { execFile } from 'child_process';
import * as path from 'path';

export interface WorktreeInfo {
	identifier: string;
	isWorktree: boolean;
}

function execGit(args: string[], cwd: string): Promise<string> {
	return new Promise((resolve, reject) => {
		execFile('git', args, { cwd }, (error, stdout) => {
			if (error) {
				reject(error);
			} else {
				resolve(stdout.trim());
			}
		});
	});
}

export async function detectWorktree(workspacePath: string): Promise<WorktreeInfo | null> {
	try {
		const [gitDir, gitCommonDir] = await Promise.all([
			execGit(['rev-parse', '--git-dir'], workspacePath),
			execGit(['rev-parse', '--git-common-dir'], workspacePath),
		]);

		const resolvedGitDir = path.resolve(workspacePath, gitDir);
		const resolvedCommonDir = path.resolve(workspacePath, gitCommonDir);

		if (resolvedGitDir !== resolvedCommonDir) {
			// It's a worktree — extract name from the worktree directory
			const worktreeName = path.basename(workspacePath);
			return {
				identifier: worktreeName,
				isWorktree: true,
			};
		}

		// Regular git repo
		return {
			identifier: path.basename(workspacePath),
			isWorktree: false,
		};
	} catch {
		return null;
	}
}

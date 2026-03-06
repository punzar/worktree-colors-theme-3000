import * as path from 'path';
import * as fs from 'fs';
import Mocha from 'mocha';

export function run(): Promise<void> {
	const mocha = new Mocha({ ui: 'bdd', color: true });
	const testsRoot = path.resolve(__dirname, '.');

	return new Promise((resolve, reject) => {
		try {
			const files = findTestFiles(testsRoot);
			files.forEach((f) => mocha.addFile(f));

			mocha.run((failures) => {
				if (failures > 0) {
					reject(new Error(`${failures} tests failed.`));
				} else {
					resolve();
				}
			});
		} catch (err) {
			reject(err);
		}
	});
}

function findTestFiles(dir: string): string[] {
	const results: string[] = [];
	for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
		const fullPath = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			results.push(...findTestFiles(fullPath));
		} else if (entry.name.endsWith('.test.js')) {
			results.push(fullPath);
		}
	}
	return results;
}

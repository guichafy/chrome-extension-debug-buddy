import type { BrowserContext } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

export function performanceEnvironment(context: BrowserContext) {
	const browser = context.browser();
	if (!browser) throw new Error('Browser indisponível para registrar versão');
	const hash = createHash('sha256');
	const visit = (directory: string) => {
		for (const entry of readdirSync(directory, { withFileTypes: true }).sort((a, b) =>
			a.name.localeCompare(b.name),
		)) {
			const file = path.join(directory, entry.name);
			if (entry.isDirectory()) visit(file);
			else if (/\.(js|html|json)$/.test(entry.name)) hash.update(file).update(readFileSync(file));
		}
	};
	visit('dist');
	return {
		chromium: browser.version(),
		node: process.version,
		os: os.platform(),
		release: os.release(),
		arch: os.arch(),
		cpu: os.cpus()[0].model,
		cores: os.cpus().length,
		memory: os.totalmem(),
		commit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
		sourceChanges: execFileSync('git', ['status', '--porcelain', '--', 'src'], {
			encoding: 'utf8',
		}).trim(),
		buildSha256: hash.digest('hex'),
	};
}

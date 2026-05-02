import { type BrowserContext, chromium } from '@playwright/test';
import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EXTENSION_PATH = path.resolve(__dirname, '../../dist');

export async function launchExtensionContext(): Promise<BrowserContext> {
	const userDataDir = await mkdtemp(path.join(os.tmpdir(), 'debug-buddy-e2e-'));
	return chromium.launchPersistentContext(userDataDir, {
		headless: true,
		args: [
			`--disable-extensions-except=${EXTENSION_PATH}`,
			`--load-extension=${EXTENSION_PATH}`,
			'--no-first-run',
			'--no-default-browser-check',
		],
	});
}

export async function getExtensionId(context: BrowserContext): Promise<string> {
	let sw = context.serviceWorkers()[0];
	if (!sw) {
		sw = await context.waitForEvent('serviceworker', { timeout: 10_000 });
	}
	const url = sw.url();
	const match = url.match(/^chrome-extension:\/\/([a-z]+)\//);
	if (!match) {
		throw new Error(`[e2e] URL de service worker inesperada: ${url}`);
	}
	return match[1];
}

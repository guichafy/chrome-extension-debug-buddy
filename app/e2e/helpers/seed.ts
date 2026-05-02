import type { BrowserContext } from '@playwright/test';
import type { Rule } from '../../src/types/rules';

export async function seedRules(context: BrowserContext, rules: Rule[]): Promise<void> {
	let sw = context.serviceWorkers()[0];
	if (!sw) {
		sw = await context.waitForEvent('serviceworker', { timeout: 10_000 });
	}

	await sw.evaluate(async (rulesToSeed) => {
		await chrome.storage.local.set({ rules: rulesToSeed });
	}, rules);
}

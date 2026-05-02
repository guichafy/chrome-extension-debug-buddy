import { expect, test } from '@playwright/test';
import type { Rule } from '../../src/types/rules';
import { getExtensionId, launchExtensionContext } from '../helpers/extension';
import { seedRules } from '../helpers/seed';

test('Golden Path: regra mocka fetch e request aparece no histórico', async () => {
	const context = await launchExtensionContext();
	const extId = await getExtensionId(context);

	const now = Date.now();
	const mockRule: Rule = {
		id: 'e2e-rule-1',
		name: 'E2E mock users',
		enabled: true,
		matchers: [
			{ type: 'url', enabled: true, pattern: '/api/users', isRegex: false },
			{ type: 'method', enabled: true, method: 'GET' },
		],
		action: {
			type: 'mock',
			enabled: true,
			status: 200,
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ users: [{ id: 1, name: 'mocked-user' }] }),
		},
		createdAt: now,
		updatedAt: now,
	};
	await seedRules(context, [mockRule]);

	const targetPage = await context.newPage();
	await targetPage.goto('http://localhost:3100/target.html');
	await expect(targetPage.locator('#users-data')).toContainText('real-user');

	const optionsPage = await context.newPage();
	await optionsPage.goto(`chrome-extension://${extId}/options.html`);

	// Open select-tab dialog and choose target tab
	await optionsPage.getByRole('button', { name: /selecionar aba/i }).click();
	// Tab list rows are <div role="option"> — see app/src/components/select-tab/TabRow.tsx
	await optionsPage.getByRole('option', { name: /target\.html/i }).click();

	// Iniciar Interceptação (button is enabled when tab is valid)
	const startButton = optionsPage.getByRole('button', { name: /iniciar interceptação/i });
	await expect(startButton).toBeEnabled();
	await startButton.click();

	// Confirm transition: button switches to Parar Interceptação
	await expect(
		optionsPage.getByRole('button', { name: /parar interceptação/i }),
	).toBeVisible();

	// Reload target tab — fetch goes through Fetch.requestPaused and is mocked
	await targetPage.bringToFront();
	await targetPage.reload();
	await expect(targetPage.locator('#users-data')).toContainText('mocked-user');

	// History: request appears in Command Center (canonical history view).
	// /request-history redirects to /command-center. Reload options page so that
	// useAllRequests re-reads IndexedDB (which background already wrote the mock request to).
	await optionsPage.goto(`chrome-extension://${extId}/options.html`);
	// IDB may take a moment; use poll to handle async load
	await expect
		.poll(
			async () => {
				return optionsPage.locator('tr', { hasText: '/api/users' }).count();
			},
			{ timeout: 8000 },
		)
		.toBeGreaterThan(0);

	await context.close();
});

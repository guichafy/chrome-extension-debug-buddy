import { expect, test } from '@playwright/test';
import type { Rule } from '../../src/types/rules';
import { getExtensionId, launchExtensionContext } from '../helpers/extension';
import { seedRules } from '../helpers/seed';

test('Golden Path: regra mocka fetch e request aparece no histórico', async () => {
	const context = await launchExtensionContext();
	try {
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

		// Abre o diálogo de seleção e escolhe a aba alvo. As linhas da lista
		// usam <div role="option"> — ver app/src/components/select-tab/TabRow.tsx.
		await optionsPage.getByRole('button', { name: /selecionar aba/i }).click();
		await optionsPage.getByRole('option', { name: /target\.html/i }).click();

		// Inicia interceptação (botão fica habilitado quando a aba é válida).
		const startButton = optionsPage.getByRole('button', { name: /iniciar interceptação/i });
		await expect(startButton).toBeEnabled();
		await startButton.click();

		// Confirma a transição: o botão muda para "Parar Interceptação".
		await expect(
			optionsPage.getByRole('button', { name: /parar interceptação/i }),
		).toBeVisible();

		// Recarrega a aba alvo: o fetch agora passa pelo Fetch.requestPaused e é mockado.
		await targetPage.bringToFront();
		await targetPage.reload();
		await expect(targetPage.locator('#users-data')).toContainText('mocked-user');

		// Histórico: a request precisa aparecer no Command Center (visão canônica).
		// Navega explicitamente para /command-center e força reload — sem o reload
		// o React Router só atualiza o fragment, sem remontar `useAllRequests`,
		// e o IndexedDB recém-populado não é relido.
		await optionsPage.goto(`chrome-extension://${extId}/options.html#/command-center`);
		await optionsPage.reload();
		await expect
			.poll(
				async () => optionsPage.locator('tr', { hasText: '/api/users' }).count(),
				{ timeout: 8000 },
			)
			.toBeGreaterThan(0);
	} finally {
		await context.close();
	}
});

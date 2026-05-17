// Helpers compartilhados pelos specs E2E que precisam ligar a interceptação
// na aba alvo. Encapsula a UI dance: abrir options, selecionar a aba, clicar
// em "Iniciar Interceptação" e aguardar a transição para o estado ativo.

import { expect, type BrowserContext, type Page } from '@playwright/test';

export interface DebuggerSetup {
	optionsPage: Page;
	extId: string;
}

export async function attachDebuggerToTarget(
	context: BrowserContext,
	extId: string,
	targetPage: Page,
): Promise<Page> {
	const optionsPage = await context.newPage();
	await optionsPage.goto(`chrome-extension://${extId}/options.html`);

	await optionsPage.getByRole('button', { name: /selecionar aba/i }).click();
	await optionsPage.getByRole('option', { name: /target\.html/i }).click();

	const startButton = optionsPage.getByRole('button', { name: /iniciar interceptação/i });
	await expect(startButton).toBeEnabled();
	await startButton.click();
	await expect(optionsPage.getByRole('button', { name: /parar interceptação/i })).toBeVisible();

	// targetPage ganha foco de novo para que requests subsequentes saiam dela.
	await targetPage.bringToFront();
	return optionsPage;
}

export async function goToCommandCenter(optionsPage: Page, extId: string): Promise<void> {
	await optionsPage.goto(`chrome-extension://${extId}/options.html#/command-center`);
	await optionsPage.reload();
}

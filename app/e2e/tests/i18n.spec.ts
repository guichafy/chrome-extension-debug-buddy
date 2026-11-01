import { expect, test } from '@playwright/test';
import { getExtensionId, launchExtensionContext } from '../helpers/extension';

// Troca de idioma pela UI real: o seletor do sidebar grava a preferência em
// chrome.storage.local, a página troca de idioma na hora, a escolha sobrevive
// ao reload e o side panel aberto em paralelo acompanha (storage.onChanged).

test('seletor de idioma troca a UI para inglês, persiste e sincroniza o side panel', async () => {
	const context = await launchExtensionContext({ uiLanguage: 'pt-BR' });
	try {
		const extId = await getExtensionId(context);

		const optionsPage = await context.newPage();
		await optionsPage.goto(`chrome-extension://${extId}/options.html`);
		await expect(optionsPage.getByRole('button', { name: 'Iniciar Análise' })).toBeVisible();
		await expect(optionsPage.locator('html')).toHaveAttribute('lang', 'pt-BR');

		const sidePanelPage = await context.newPage();
		await sidePanelPage.goto(`chrome-extension://${extId}/sidepanel.html`);
		await expect(sidePanelPage.getByRole('button', { name: 'Iniciar Análise' })).toBeVisible();

		await optionsPage.bringToFront();
		await optionsPage.getByRole('combobox', { name: 'Idioma' }).click();
		await optionsPage.getByRole('option', { name: 'English' }).click();

		await expect(optionsPage.getByRole('button', { name: 'Start Analysis' })).toBeVisible();
		await expect(optionsPage.getByRole('link', { name: 'Sessions' })).toBeVisible();
		await expect(optionsPage.locator('html')).toHaveAttribute('lang', 'en');
		await expect(sidePanelPage.getByRole('button', { name: 'Start Analysis' })).toBeVisible();

		const [sw] = context.serviceWorkers();
		expect(await sw.evaluate(() => chrome.storage.local.get('uiLanguage'))).toEqual({
			uiLanguage: 'en',
		});

		await optionsPage.reload();
		await expect(optionsPage.getByRole('button', { name: 'Start Analysis' })).toBeVisible();

		await optionsPage.getByRole('combobox', { name: 'Language' }).click();
		await optionsPage.getByRole('option', { name: 'Português (Brasil)' }).click();
		await expect(optionsPage.getByRole('button', { name: 'Iniciar Análise' })).toBeVisible();
		await expect(sidePanelPage.getByRole('button', { name: 'Iniciar Análise' })).toBeVisible();
	} finally {
		await context.close();
	}
});

// Sem preferência salva a UI segue `chrome.i18n.getUILanguage()`, que nas
// páginas da extensão reflete o locale emulado pelo Playwright.
for (const { locale, lang, start } of [
	{ locale: 'pt-BR', lang: 'pt-BR', start: 'Iniciar Análise' },
	{ locale: 'de-DE', lang: 'en', start: 'Start Analysis' },
]) {
	test(`sem preferência salva, navegador em ${locale} abre a UI em ${lang}`, async () => {
		const context = await launchExtensionContext({ uiLanguage: null, locale });
		try {
			const extId = await getExtensionId(context);
			const optionsPage = await context.newPage();
			await optionsPage.goto(`chrome-extension://${extId}/options.html`);

			await expect(optionsPage.getByRole('button', { name: start })).toBeVisible();
			await expect(optionsPage.locator('html')).toHaveAttribute('lang', lang);
		} finally {
			await context.close();
		}
	});
}

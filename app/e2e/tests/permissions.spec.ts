import { expect, test } from '@playwright/test';
import { attachDebuggerToTarget } from '../helpers/debugger';
import { getExtensionId, launchExtensionContext } from '../helpers/extension';

// Garante que a extensão continua funcional sem as permissões `tabs` e
// `webNavigation` (removidas para reduzir o escopo pedido na Chrome Web Store).
// - `tabs`: url/title das abas vêm da host permission <all_urls>.
// - `webNavigation`: navegação do main frame chega via CDP Page.frameNavigated.

const TARGET_URL = 'http://localhost:3100/target.html';

test('manifest não pede tabs nem webNavigation', async () => {
	const context = await launchExtensionContext();
	try {
		await getExtensionId(context);
		const [sw] = context.serviceWorkers();
		const permissions = await sw.evaluate(() => chrome.runtime.getManifest().permissions ?? []);
		expect(permissions).not.toContain('tabs');
		expect(permissions).not.toContain('webNavigation');
	} finally {
		await context.close();
	}
});

test('sem "tabs": host permission expõe url/title e scripting injeta na aba', async () => {
	const context = await launchExtensionContext();
	try {
		await getExtensionId(context);
		const [sw] = context.serviceWorkers();
		const targetPage = await context.newPage();
		await targetPage.goto(TARGET_URL);

		const tab = await sw.evaluate(async (url) => {
			const tabs = await chrome.tabs.query({});
			const found = tabs.find((t) => t.url === url);
			if (!found?.id) throw new Error(`aba ${url} não encontrada (url ausente?)`);
			const injected = await chrome.scripting.executeScript({
				target: { tabId: found.id },
				func: () => document.title,
			});
			return { url: found.url, title: found.title, injectedTitle: injected[0]?.result };
		}, TARGET_URL);

		expect(tab).toEqual({ url: TARGET_URL, title: 'E2E Target', injectedTitle: 'E2E Target' });
	} finally {
		await context.close();
	}
});

test('sem "webNavigation": navegação na aba analisada gera evento de rota e sincroniza a URL', async () => {
	const context = await launchExtensionContext();
	try {
		const extId = await getExtensionId(context);
		const targetPage = await context.newPage();
		await targetPage.goto(TARGET_URL);
		const optionsPage = await attachDebuggerToTarget(context, extId, targetPage);

		const navigatedUrl = `${TARGET_URL}?nav=2`;
		await targetPage.goto(navigatedUrl);

		// tabs.onUpdated (sem permissão `tabs`) mantém targetTabInfo atualizado.
		await expect
			.poll(
				() =>
					optionsPage.evaluate(async () => {
						const { targetTabInfo } = await chrome.storage.local.get('targetTabInfo');
						return (targetTabInfo as { url?: string } | undefined)?.url ?? null;
					}),
				{ timeout: 10_000 },
			)
			.toBe(navigatedUrl);

		// Page.frameNavigated grava o RouteChangeEvent na sessão de gravação ativa.
		await expect
			.poll(
				() =>
					optionsPage.evaluate(
						(url) =>
							new Promise<boolean>((resolve, reject) => {
								const req = indexedDB.open('debugger-extension-db');
								req.onerror = () => reject(req.error);
								req.onsuccess = () => {
									const db = req.result;
									const getAll = db.transaction('sessions').objectStore('sessions').getAll();
									getAll.onerror = () => reject(getAll.error);
									getAll.onsuccess = () => {
										const sessions = getAll.result as Array<{
											endedAt: number | null;
											events: Array<{ type: string; url?: string }>;
										}>;
										db.close();
										resolve(
											sessions.some(
												(s) =>
													s.endedAt === null &&
													s.events.some((e) => e.type === 'route' && e.url === url),
											),
										);
									};
								};
							}),
						navigatedUrl,
					),
				{ timeout: 15_000 },
			)
			.toBe(true);
	} finally {
		await context.close();
	}
});

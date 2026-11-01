import { expect, test, type Page } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import type { InterceptedResponse } from '../../src/types/intercepted';
import type { Message, MessageResponse } from '../../src/types/messages';
import { getExtensionId, launchExtensionContext } from '../helpers/extension';
import { startRecordingFixture } from './recordingFixture';
import {
	attachNativePanel,
	closeNativePanel,
	findNativePanelTarget,
	nativePanelContexts,
	openNativePanel,
} from './nativePanelHarness';

async function nativeMessage(page: Page, message: Message): Promise<MessageResponse> {
	const result = await page.evaluate((value) => chrome.runtime.sendMessage(value), message);
	if (!result || result.error || result.success === false || result.ok === false)
		throw new Error(`${message.action}: ${JSON.stringify(result)}`);
	return result;
}

async function nativeCapture(target: Page, options: Page, seq: number) {
	const result = await target.evaluate(async (value) => {
		const response = await fetch(`/recording-payload?seq=${value}`, {
			cache: 'no-store',
			signal: AbortSignal.timeout(10_000),
		});
		if (!response.ok) throw new Error(`HTTP ${response.status}`);
		return response.json();
	}, seq);
	expect(result.seq).toBe(seq);
	let captured: [string, InterceptedResponse] | undefined;
	await expect
		.poll(
			async () => {
				const response = await nativeMessage(options, { action: 'getAllRequests' });
				if (!response.allRequests) throw new Error('getAllRequests sem dados');
				captured = Object.entries(response.allRequests).find(([, request]) =>
					request.url.endsWith(`/recording-payload?seq=${seq}`),
				);
				return typeof captured?.[1].duration === 'number';
			},
			{ timeout: 10_000 },
		)
		.toBe(true);
	if (!captured) throw new Error(`Captura ${seq} ausente`);
	return { id: captured[0], request: captured[1] };
}

test('Side Panel nativo: mensagens ao vivo e resync de IDB após fechar/reabrir', async ({
	browserName,
}, testInfo) => {
	test.setTimeout(120_000);
	const fixture = await startRecordingFixture();
	const context = await launchExtensionContext();
	context.setDefaultTimeout(15_000);
	const evidence: Record<string, unknown> = {
		nativeHostVerified: false,
		received: fixture.received,
		completed: fixture.completed,
		stages: [],
	};
	const stages = evidence.stages as Array<{ name: string; at: number }>;
	const stage = (name: string) => {
		stages.push({ name, at: Date.now() });
	};
	let panel: Awaited<ReturnType<typeof attachNativePanel>> | undefined;
	await context.tracing.start({ screenshots: true, snapshots: false });
	try {
		stage('captura real antes de abrir painel');
		const extensionId = await getExtensionId(context);
		const origin = `chrome-extension://${extensionId}`;
		const target = await context.newPage();
		await target.goto(`${fixture.origin}/recording-target.html`);
		const options = await context.newPage();
		await options.goto(`${origin}/options.html#/command-center`);
		const tabId = await options.evaluate(async (url) => {
			const tab = (await chrome.tabs.query({})).find((candidate) => candidate.url === url);
			if (tab?.id === undefined) throw new Error('Aba alvo ausente');
			return tab.id;
		}, target.url());
		await nativeMessage(options, {
			action: 'setTargetTab',
			tabId,
			tabUrl: target.url(),
			tabTitle: 'Native Side Panel target',
		});
		await nativeMessage(options, { action: 'startDebugging', tabId });
		const first = await nativeCapture(target, options, 0);
		const router = await context.newCDPSession(options);

		stage('gesto confiável e descoberta do host SIDE_PANEL');
		const windowId = await openNativePanel(options);
		await expect
			.poll(async () => (await nativePanelContexts(options)).length, { timeout: 10_000 })
			.toBe(1);
		const contexts = await nativePanelContexts(options);
		expect(contexts[0].contextType).toBe('SIDE_PANEL');
		// ExtensionContext.windowId pode ser -1 para contexto global sem associação
		// de janela; o host é provado por SIDE_PANEL, tabId=-1 e ausência em tabs.
		// https://developer.chrome.com/docs/extensions/reference/api/runtime#type-ExtensionContext
		expect([-1, windowId]).toContain(contexts[0].windowId);
		expect(contexts[0].tabId).toBe(-1);
		evidence.requestedWindowId = windowId;
		expect(contexts[0].documentUrl).toContain(`${origin}/sidepanel.html`);
		const sidePanelTabs = await options.evaluate(
			async (base) =>
				(await chrome.tabs.query({})).filter((tab) =>
					tab.url?.startsWith(`${base}/sidepanel.html`),
				),
			origin,
		);
		expect(sidePanelTabs, 'documento nativo não pode ser uma aba sidepanel.html regular').toEqual(
			[],
		);
		panel = await attachNativePanel(router, origin);
		evidence.nativeHostVerified = true;
		evidence.firstContexts = contexts;
		evidence.firstTarget = panel.target;
		const firstPanel = panel;
		await expect
			.poll(
				() =>
					firstPanel.evaluate(
						() => document.body.innerText.includes('recording-payload?seq=0'),
						null,
					),
				{ timeout: 10_000 },
			)
			.toBe(true);
		await panel
			.evaluate(() => {
				const state = window as Window & {
					__nativePanelMessages?: Array<{ action: string; requestId?: string; duration?: number }>;
				};
				state.__nativePanelMessages = [];
				chrome.runtime.onMessage.addListener((message) => {
					if (message.action === 'newRequest' || message.action === 'requestUpdated')
						state.__nativePanelMessages?.push({
							action: message.action,
							requestId: message.requestId,
							duration: message.updates?.duration,
						});
					return false;
				});
				return {
					href: location.href,
					visibility: document.visibilityState,
					width: innerWidth,
					height: innerHeight,
				};
			}, null)
			.then((state) => {
				evidence.firstViewport = state;
			});

		stage('broadcast de captura e patch de duração no painel aberto');
		const live = await nativeCapture(target, options, 1);
		await expect
			.poll(
				() =>
					firstPanel.evaluate(
						() => document.body.innerText.includes('recording-payload?seq=1'),
						null,
					),
				{ timeout: 5_000 },
			)
			.toBe(true);
		await expect
			.poll(
				() =>
					firstPanel.evaluate((id) => {
						const messages = (
							window as Window & {
								__nativePanelMessages?: Array<{
									action: string;
									requestId?: string;
									duration?: number;
								}>;
							}
						).__nativePanelMessages;
						if (!messages) throw new Error('Observador de mensagens nativas ausente');
						return messages.some(
							(message) =>
								message.action === 'requestUpdated' &&
								message.requestId === id &&
								typeof message.duration === 'number',
						);
					}, live.id),
				{ timeout: 5_000 },
			)
			.toBe(true);
		const messages = await panel.evaluate(
			() => (window as Window & { __nativePanelMessages?: unknown[] }).__nativePanelMessages,
			null,
		);
		evidence.liveMessages = messages;
		expect(messages).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ action: 'newRequest', requestId: live.id }),
			]),
		);
		await panel.click('tr', 'recording-payload?seq=1');
		await panel.click('[role="tab"]', 'Response');
		await expect
			.poll(
				() =>
					firstPanel.evaluate(() => {
						const pre = document.querySelector('[role="tabpanel"][data-state="active"] pre');
						return pre ? JSON.parse(pre.textContent!) : null;
					}, null),
				{ timeout: 5_000 },
			)
			.toEqual(resultBody(1));
		expect(panel.errors).toEqual([]);
		try {
			const screenshot = await panel.command<{ data: string }>('Page.captureScreenshot', {
				format: 'png',
			});
			const screenshotPath = testInfo.outputPath('native-side-panel.png');
			await writeFile(screenshotPath, Buffer.from(screenshot.data, 'base64'));
			await testInfo.attach('native-side-panel', {
				path: screenshotPath,
				contentType: 'image/png',
			});
		} catch (error) {
			evidence.screenshotUnavailable = String(error);
		}
		await panel.detach();
		panel = undefined;

		stage('fechamento nativo e nova captura com painel fechado');
		await closeNativePanel(options, windowId);
		await expect
			.poll(
				async () => {
					const existing = await findNativePanelTarget(router, origin);
					if (!existing) return true;
					const hidden = await attachNativePanel(router, origin);
					try {
						return await hidden.evaluate(() => document.visibilityState === 'hidden', null);
					} finally {
						await hidden.detach();
					}
				},
				{ timeout: 10_000 },
			)
			.toBe(true);
		const whileClosed = await nativeCapture(target, options, 2);
		await nativeMessage(options, { action: 'stopDebugging' });
		expect(
			(await nativeMessage(options, { action: 'getPendingInterceptions' })).pendingInterceptions,
		).toEqual({});

		stage('atualização IDB sem broadcast para provar resync');
		const resyncedBody = JSON.stringify({
			seq: 0,
			resynced: true,
			source: 'IDB enquanto painel fechado',
		});
		await options.evaluate(
			async ({ id, body }) => {
				const db = await new Promise<IDBDatabase>((resolve, reject) => {
					const open = indexedDB.open('debugger-extension-db');
					open.onerror = () => reject(open.error);
					open.onsuccess = () => resolve(open.result);
				});
				await new Promise<void>((resolve, reject) => {
					const tx = db.transaction('requests', 'readwrite');
					const store = tx.objectStore('requests');
					const get = store.get(id);
					get.onerror = () => reject(get.error);
					get.onsuccess = () => {
						const record = get.result;
						if (!record) {
							tx.abort();
							reject(new Error('Request ausente no IDB'));
							return;
						}
						record.data.body = body;
						if (record.data.response) record.data.response.body = body;
						record.data.status = 201;
						record.data.statusText = 'Created';
						store.put(record);
					};
					tx.oncomplete = () => resolve();
					tx.onerror = () => reject(tx.error);
					tx.onabort = () => reject(tx.error);
				});
				db.close();
			},
			{ id: first.id, body: resyncedBody },
		);

		stage('reabertura nativa e leitura do snapshot atualizado');
		expect(await openNativePanel(options)).toBe(windowId);
		panel = await attachNativePanel(router, origin);
		const reopenedPanel = panel;
		await expect
			.poll(
				() =>
					reopenedPanel.evaluate(() => {
						const text = document.body.innerText;
						return [0, 1, 2].every((seq) => text.includes(`recording-payload?seq=${seq}`));
					}, null),
				{ timeout: 10_000 },
			)
			.toBe(true);
		await panel.click('tr', 'recording-payload?seq=0');
		await panel.click('[role="tab"]', 'Response');
		await expect
			.poll(
				() =>
					reopenedPanel.evaluate(() => {
						const pre = document.querySelector('[role="tabpanel"][data-state="active"] pre');
						return pre ? JSON.parse(pre.textContent!) : null;
					}, null),
				{ timeout: 5_000 },
			)
			.toEqual(JSON.parse(resyncedBody));
		expect(
			await panel.evaluate(
				() =>
					document
						.querySelector('[data-testid="request-inspector-header"]')
						?.textContent?.includes('201'),
				null,
			),
		).toBe(true);
		expect(
			await options.evaluate(
				async (base) =>
					(await chrome.tabs.query({})).some((tab) =>
						tab.url?.startsWith(`${base}/sidepanel.html`),
					),
				origin,
			),
		).toBe(false);
		evidence.reopenedContexts = await nativePanelContexts(options);
		evidence.reopenedTarget = panel.target;
		evidence.requestIds = [first.id, live.id, whileClosed.id];
		evidence.resyncVerified = true;
		expect(panel.errors).toEqual([]);
		expect(fixture.received).toEqual([0, 1, 2]);
		expect(fixture.completed).toEqual([0, 1, 2]);
		await panel.detach();
		panel = undefined;
		await closeNativePanel(options, windowId);
		await router.detach();
		stage('concluído');
	} finally {
		if (panel) {
			evidence.panelErrors = panel.errors;
			try {
				await panel.detach();
			} catch (error) {
				evidence.detachError = String(error);
			}
		}
		try {
			const file = testInfo.outputPath('native-panel-evidence.json');
			await writeFile(file, JSON.stringify(evidence, null, 2));
			await testInfo.attach('native-panel-evidence', {
				path: file,
				contentType: 'application/json',
			});
			await context.tracing.stop({ path: testInfo.outputPath('native-panel-first-run-trace.zip') });
		} finally {
			try {
				await context.close();
			} finally {
				await fixture.close();
			}
		}
	}
});

function resultBody(seq: number) {
	return { seq, payload: 'recording-performance-'.repeat(100) };
}

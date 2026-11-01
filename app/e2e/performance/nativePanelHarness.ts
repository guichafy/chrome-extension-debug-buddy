import { expect, type CDPSession, type Page } from '@playwright/test';

export interface NativePanelContext {
	contextId: string;
	contextType: 'SIDE_PANEL';
	documentUrl: string;
	windowId: number;
	tabId: number;
}

/** API de Chrome 116+, ausente na versão antiga de @types/chrome do projeto. */
export async function nativePanelContexts(page: Page): Promise<NativePanelContext[]> {
	return page.evaluate(() => {
		const runtime = chrome.runtime as typeof chrome.runtime & {
			getContexts(filter: { contextTypes: string[] }): Promise<NativePanelContext[]>;
		};
		if (typeof runtime.getContexts !== 'function')
			throw new Error('Chrome sem runtime.getContexts');
		return runtime.getContexts({ contextTypes: ['SIDE_PANEL'] });
	});
}

/** O gesto vem de Playwright.click; não chamamos open através de evaluate sem gesto. */
export async function openNativePanel(page: Page) {
	const windowId = await page.evaluate(async () => {
		const current = await chrome.windows.getCurrent();
		if (current.id === undefined) throw new Error('Janela da extensão sem ID');
		return current.id;
	});
	await page.evaluate((id) => {
		document.getElementById('native-panel-test-open')?.remove();
		const button = document.createElement('button');
		button.id = 'native-panel-test-open';
		button.textContent = 'Abrir Side Panel nativo para teste';
		button.style.cssText =
			'position:fixed;top:0;left:0;z-index:2147483647;background:white;color:black;padding:10px';
		button.dataset.state = 'ready';
		button.addEventListener('click', (event) => {
			button.dataset.trusted = String(event.isTrusted);
			chrome.sidePanel.open({ windowId: id }).then(
				() => {
					button.dataset.state = 'opened';
				},
				(error) => {
					button.dataset.state = 'error';
					button.dataset.error = String(error);
				},
			);
		});
		document.body.appendChild(button);
	}, windowId);
	await page.bringToFront();
	const button = page.locator('#native-panel-test-open');
	await button.click();
	await expect
		.poll(
			async () => {
				const state = await button.getAttribute('data-state');
				if (state === 'error')
					throw new Error(`sidePanel.open falhou: ${await button.getAttribute('data-error')}`);
				return state;
			},
			{ timeout: 10_000 },
		)
		.toBe('opened');
	await expect(button).toHaveAttribute('data-trusted', 'true');
	return windowId;
}

/** sidePanel.close foi adicionada no Chrome 141; falha explícita em versão incompatível. */
export async function closeNativePanel(page: Page, windowId: number) {
	await page.evaluate(async (id) => {
		const sidePanel = chrome.sidePanel as typeof chrome.sidePanel & {
			close(options: { windowId: number }): Promise<void>;
		};
		if (typeof sidePanel.close !== 'function')
			throw new Error('Chrome sem sidePanel.close (requer 141+)');
		await sidePanel.close({ windowId: id });
	}, windowId);
}

export async function findNativePanelTarget(router: CDPSession, origin: string) {
	const targets = await router.send('Target.getTargets');
	const matches = targets.targetInfos.filter((target) =>
		target.url.startsWith(`${origin}/sidepanel.html`),
	);
	if (matches.length > 1)
		throw new Error(`Mais de um target de sidepanel: ${JSON.stringify(matches)}`);
	return matches[0];
}

export async function attachNativePanel(router: CDPSession, origin: string) {
	let target = await findNativePanelTarget(router, origin);
	await expect
		.poll(
			async () => {
				target = await findNativePanelTarget(router, origin);
				return target !== undefined;
			},
			{ timeout: 10_000 },
		)
		.toBe(true);
	if (!target) throw new Error('Side Panel nativo não expôs target CDP');
	const { sessionId } = await router.send('Target.attachToTarget', {
		targetId: target.targetId,
		flatten: false,
	});
	let nextId = 0;
	const errors: unknown[] = [];
	const onEvent = (event: { sessionId: string; message: string }) => {
		if (event.sessionId !== sessionId) return;
		const message = JSON.parse(event.message);
		if (message.method === 'Runtime.exceptionThrown') errors.push(message.params);
		if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error')
			errors.push(message.params);
	};
	router.on('Target.receivedMessageFromTarget', onEvent);
	async function command<T>(method: string, params: Record<string, unknown> = {}): Promise<T> {
		const id = ++nextId;
		return new Promise<T>((resolve, reject) => {
			const timer = setTimeout(() => {
				router.off('Target.receivedMessageFromTarget', listener);
				reject(new Error(`Timeout CDP do Side Panel: ${method}`));
			}, 5_000);
			const listener = (event: { sessionId: string; message: string }) => {
				if (event.sessionId !== sessionId) return;
				const response = JSON.parse(event.message);
				if (response.id !== id) return;
				clearTimeout(timer);
				router.off('Target.receivedMessageFromTarget', listener);
				if (response.error) reject(new Error(`${method}: ${JSON.stringify(response.error)}`));
				else resolve(response.result as T);
			};
			router.on('Target.receivedMessageFromTarget', listener);
			void router
				.send('Target.sendMessageToTarget', {
					sessionId,
					message: JSON.stringify({ id, method, params }),
				})
				.catch((error) => {
					clearTimeout(timer);
					router.off('Target.receivedMessageFromTarget', listener);
					reject(error);
				});
		});
	}
	async function evaluate<T, A>(fn: (arg: A) => T | Promise<T>, arg: A): Promise<T> {
		const result = await command<{ result: { value: T }; exceptionDetails?: unknown }>(
			'Runtime.evaluate',
			{
				expression: `(${fn.toString()})(${JSON.stringify(arg)})`,
				awaitPromise: true,
				returnByValue: true,
			},
		);
		if (result.exceptionDetails)
			throw new Error(`Side Panel evaluate: ${JSON.stringify(result.exceptionDetails)}`);
		return result.result.value;
	}
	await command('Runtime.enable');
	return {
		target,
		errors,
		evaluate,
		command,
		click: async (selector: string, text: string) => {
			const point = await evaluate(
				({ selector, text }) => {
					const node = Array.from(document.querySelectorAll<HTMLElement>(selector)).find(
						(candidate) =>
							candidate.textContent?.includes(text) && candidate.getBoundingClientRect().height > 0,
					);
					if (!node) throw new Error(`Elemento nativo ausente: ${selector} / ${text}`);
					node.scrollIntoView({ block: 'center', inline: 'nearest' });
					const rect = node.getBoundingClientRect();
					const left = Math.max(rect.left, 0);
					const right = Math.min(rect.right, window.innerWidth);
					const top = Math.max(rect.top, 0);
					const bottom = Math.min(rect.bottom, window.innerHeight);
					if (right <= left || bottom <= top) throw new Error('Elemento fora do viewport nativo');
					return { x: (left + right) / 2, y: (top + bottom) / 2 };
				},
				{ selector, text },
			);
			await command('Input.dispatchMouseEvent', {
				type: 'mousePressed',
				...point,
				button: 'left',
				clickCount: 1,
			});
			await command('Input.dispatchMouseEvent', {
				type: 'mouseReleased',
				...point,
				button: 'left',
				clickCount: 1,
			});
		},
		detach: async () => {
			router.off('Target.receivedMessageFromTarget', onEvent);
			await router.send('Target.detachFromTarget', { sessionId });
		},
	};
}

// Testa o offscreen document que serve de bridge entre o service worker
// (background.ts) e o iframe sandbox de Transform avançado.
//
// Estratégia:
// - mockamos `chrome.runtime.onMessage.addListener` capturando o handler
// - mockamos `chrome.runtime.getURL` para uma URL plausível
// - patcheamos `document.createElement('iframe')` para devolver um iframe
//   cujo `contentWindow` simula o sandbox real (avalia o script com
//   `new Function` e responde via `window.postMessage`)
// - disparamos uma mensagem `runAdvancedTransform` e capturamos a chamada de
//   `sendResponse` para validar a resposta.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type OffscreenListener = (
	message: unknown,
	sender: unknown,
	sendResponse: (response: unknown) => void,
) => boolean | undefined;

interface SandboxRequest {
	id: string;
	script: string;
	response: unknown;
}

let originalCreateElement: typeof document.createElement;
let originalChrome: unknown;
let capturedListener: OffscreenListener | null = null;

function installSandboxIframe(): void {
	originalCreateElement = document.createElement.bind(document);
	document.createElement = ((tagName: string) => {
		const el = (originalCreateElement as (t: string) => HTMLElement)(tagName) as HTMLElement & {
			contentWindow?: Window;
		};
		if (tagName.toLowerCase() === 'iframe') {
			const fakeWin = {
				postMessage(message: unknown): void {
					const req = message as SandboxRequest;
					queueMicrotask(() => {
						try {
							const fn = new Function('response', req.script) as (r: unknown) => unknown;
							const output = fn(req.response);
							window.postMessage({ id: req.id, ok: true, output }, '*');
						} catch (err) {
							window.postMessage(
								{ id: req.id, ok: false, error: `Erro de execução: ${(err as Error).message}` },
								'*',
							);
						}
					});
				},
			} as unknown as Window;
			Object.defineProperty(el, 'contentWindow', { value: fakeWin, configurable: true });
			// Dispara o "ready signal" assim que o iframe é anexado, para que o
			// offscreen libere a fila de envios sem depender do load real.
			queueMicrotask(() => {
				window.postMessage({ type: 'debug-buddy-sandbox-ready' }, '*');
			});
		}
		return el;
	}) as typeof document.createElement;
}

function uninstallSandboxIframe(): void {
	if (originalCreateElement) document.createElement = originalCreateElement;
}

beforeEach(async () => {
	vi.resetModules();
	originalChrome = (globalThis as { chrome?: unknown }).chrome;
	capturedListener = null;
	(globalThis as { chrome?: unknown }).chrome = {
		runtime: {
			getURL: (path: string) => `chrome-extension://test/${path}`,
			onMessage: {
				addListener: (listener: OffscreenListener) => {
					capturedListener = listener;
				},
			},
		},
	};
	installSandboxIframe();
	await import('../main');
});

afterEach(() => {
	uninstallSandboxIframe();
	(globalThis as { chrome?: unknown }).chrome = originalChrome;
	vi.restoreAllMocks();
});

function callOffscreen(message: unknown): Promise<unknown> {
	return new Promise<unknown>((resolve) => {
		if (!capturedListener) {
			throw new Error('Offscreen listener não registrado');
		}
		const sendResponse = (reply: unknown) => resolve(reply);
		const ret = capturedListener(message, {}, sendResponse);
		// O contrato do Chrome exige `return true` para resposta async — se o
		// listener retornar false, isso é um sinal de que ele decidiu não tratar
		// a mensagem. Só forçamos a Promise a resolver pelo sendResponse.
		void ret;
	});
}

describe('offscreen/main — bridge para sandbox de Transform avançado', () => {
	it('executa script via iframe sandbox e retorna ok=true', async () => {
		const reply = (await callOffscreen({
			target: 'offscreen',
			action: 'runAdvancedTransform',
			id: 'req-1',
			script: 'return response.value + 1;',
			response: { value: 41 },
		})) as { ok: boolean; output?: unknown };
		expect(reply.ok).toBe(true);
		expect(reply.output).toBe(42);
	});

	it('propaga erro de execução do sandbox', async () => {
		const reply = (await callOffscreen({
			target: 'offscreen',
			action: 'runAdvancedTransform',
			id: 'req-2',
			script: 'throw new Error("boom");',
			response: null,
		})) as { ok: boolean; error?: string };
		expect(reply.ok).toBe(false);
		expect((reply.error ?? '').toLowerCase()).toContain('execução');
	});

	it('ignora mensagens com target diferente de offscreen', () => {
		if (!capturedListener) throw new Error('listener não registrado');
		const ret = capturedListener({ action: 'runAdvancedTransform' }, {}, () => {});
		expect(ret).toBe(false);
	});

	it('ignora mensagens com action desconhecida', () => {
		if (!capturedListener) throw new Error('listener não registrado');
		const ret = capturedListener({ target: 'offscreen', action: 'algumaOutraCoisa' }, {}, () => {});
		expect(ret).toBe(false);
	});
});

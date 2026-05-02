// Testa o caminho `runViaIframe` do advanced script runner. jsdom não executa
// scripts dentro de iframes reais — então monkey-patcheamos
// `document.createElement` para que o iframe tenha um `contentWindow` falso
// que se comporta como o sandbox real (avalia o script com `new Function` e
// devolve via `window.postMessage`).

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
	__resetAdvancedScriptRunnerForTests,
	runAdvancedScript,
} from '../advancedScriptRunner';

interface SandboxRequest {
	id: string;
	script: string;
	response: unknown;
}

const SANDBOX_URL = 'chrome-extension://test/sandbox.html';

let originalCreateElement: typeof document.createElement;
let originalChrome: unknown;

function installFakeSandbox(): void {
	originalCreateElement = document.createElement.bind(document);
	document.createElement = ((tagName: string, ...rest: unknown[]) => {
		const el = (originalCreateElement as (t: string) => HTMLElement)(tagName) as HTMLElement & {
			contentWindow?: Window;
		};
		void rest;
		if (tagName.toLowerCase() === 'iframe') {
			const fakeWin = {
				postMessage(message: unknown): void {
					const req = message as SandboxRequest;
					queueMicrotask(() => {
						try {
							// biome-ignore lint/suspicious/noFunctionConstructor: simulação do sandbox em teste
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
		}
		return el;
	}) as typeof document.createElement;
}

function uninstallFakeSandbox(): void {
	if (originalCreateElement) {
		document.createElement = originalCreateElement;
	}
}

beforeEach(() => {
	__resetAdvancedScriptRunnerForTests();
	originalChrome = (globalThis as { chrome?: unknown }).chrome;
	(globalThis as { chrome?: unknown }).chrome = {
		runtime: { getURL: (path: string) => `chrome-extension://test/${path}` },
	};
	installFakeSandbox();
});

afterEach(() => {
	uninstallFakeSandbox();
	(globalThis as { chrome?: unknown }).chrome = originalChrome;
	__resetAdvancedScriptRunnerForTests();
});

describe('advancedScriptRunner — runViaIframe (sandbox simulado)', () => {
	it('executa script válido e devolve o output', async () => {
		const r = await runAdvancedScript('return response * 2;', 21);
		expect(r.ok).toBe(true);
		if (r.ok) expect(r.output).toBe(42);
		expect(SANDBOX_URL).toBe(SANDBOX_URL); // sanity (manter referência)
	});

	it('propaga erro de execução do sandbox sem fallback silencioso', async () => {
		const r = await runAdvancedScript('throw new Error("boom");', null);
		expect(r.ok).toBe(false);
		if (!r.ok) expect(r.error.toLowerCase()).toContain('execução');
	});

	it('aplica timeout quando o sandbox não responde', async () => {
		// Sobrescreve postMessage para nunca responder
		document.createElement = ((tagName: string) => {
			const el = originalCreateElement(tagName) as HTMLElement & { contentWindow?: Window };
			if (tagName.toLowerCase() === 'iframe') {
				const silentWin = { postMessage(): void {} } as unknown as Window;
				Object.defineProperty(el, 'contentWindow', { value: silentWin, configurable: true });
			}
			return el;
		}) as typeof document.createElement;

		const r = await runAdvancedScript('return response;', 1, { timeoutMs: 30 });
		expect(r.ok).toBe(false);
		if (!r.ok) expect(r.error.toLowerCase()).toContain('timeout');
	});

	it('falha com mensagem clara quando contentWindow não está disponível', async () => {
		document.createElement = ((tagName: string) => {
			const el = originalCreateElement(tagName) as HTMLElement & { contentWindow?: Window };
			if (tagName.toLowerCase() === 'iframe') {
				Object.defineProperty(el, 'contentWindow', { value: null, configurable: true });
			}
			return el;
		}) as typeof document.createElement;

		const r = await runAdvancedScript('return response;', 1, { timeoutMs: 100 });
		expect(r.ok).toBe(false);
		if (!r.ok) expect(r.error.toLowerCase()).toMatch(/contentwindow|sandbox/);
	});
});

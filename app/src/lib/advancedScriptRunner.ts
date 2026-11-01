// Runner que executa scripts JS avançados de Transform sobre uma resposta
// JSON de exemplo, retornando a saída transformada ou o erro.
//
// Em produção (extension page MV3), o CSP padrão proíbe `new Function`.
// Para contornar, declaramos uma `sandbox.html` em `manifest.json` —
// páginas sandbox rodam em origem nula com CSP relaxado e podem avaliar
// código dinâmico. Comunicação acontece via iframe + postMessage.
//
// Em testes (jsdom) e ambientes onde `chrome.runtime.getURL` não está
// disponível, caímos em execução direta com `new Function`. Filosofia
// "no fallbacks" do projeto se mantém: erros de execução sempre voltam
// ao chamador como `{ ok: false, error }`, nunca silenciados.

import { i18n } from '@/i18n/instance';

export type AdvancedScriptResult =
	| { ok: true; output: unknown }
	| { ok: false; error: string };

interface SandboxRequest {
	id: string;
	script: string;
	response: unknown;
}

interface SandboxReply {
	id: string;
	ok: boolean;
	output?: unknown;
	error?: string;
}

interface IframeRunner {
	iframe: HTMLIFrameElement;
	pending: Map<string, (r: AdvancedScriptResult) => void>;
}

let iframeRunner: IframeRunner | null = null;
let detectedDirectEval: boolean | null = null;

function newRequestId(): string {
	if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
		return crypto.randomUUID();
	}
	return `adv-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function canUseDirectEval(): boolean {
	if (detectedDirectEval !== null) return detectedDirectEval;
	try {
		// biome-ignore lint/suspicious/noFunctionConstructor: detecção intencional
		const fn = new Function('return 1');
		fn();
		detectedDirectEval = true;
	} catch {
		detectedDirectEval = false;
	}
	return detectedDirectEval;
}

function getSandboxUrl(): string | null {
	const c = (globalThis as { chrome?: { runtime?: { getURL?: (path: string) => string } } })
		.chrome;
	if (c?.runtime?.getURL) {
		try {
			return c.runtime.getURL('sandbox.html');
		} catch {
			return null;
		}
	}
	return null;
}

function ensureIframeRunner(): IframeRunner | null {
	if (iframeRunner) return iframeRunner;
	if (typeof document === 'undefined') return null;
	const url = getSandboxUrl();
	if (!url) return null;

	const iframe = document.createElement('iframe');
	iframe.src = url;
	iframe.setAttribute('aria-hidden', 'true');
	iframe.style.cssText = 'position:absolute;width:0;height:0;border:0;visibility:hidden;';
	iframe.title = 'debug-buddy-transform-sandbox';
	document.body.appendChild(iframe);

	const pending = new Map<string, (r: AdvancedScriptResult) => void>();

	window.addEventListener('message', (event: MessageEvent) => {
		const data = event.data as SandboxReply | undefined;
		if (!data || typeof data !== 'object') return;
		if (typeof data.id !== 'string') return;
		const cb = pending.get(data.id);
		if (!cb) return;
		pending.delete(data.id);
		if (data.ok) {
			cb({ ok: true, output: data.output });
		} else {
			cb({ ok: false, error: data.error ?? i18n.t('ruleEditor:scriptRunner.sandboxUnknown') });
		}
	});

	iframeRunner = { iframe, pending };
	return iframeRunner;
}

function runDirect(script: string, response: unknown): Promise<AdvancedScriptResult> {
	return new Promise((resolve) => {
		let fn: (response: unknown) => unknown;
		try {
			// biome-ignore lint/suspicious/noFunctionConstructor: avaliação intencional do script do usuário
			fn = new Function('response', script) as (response: unknown) => unknown;
		} catch (err) {
			resolve({
				ok: false,
				error: i18n.t('ruleEditor:scriptRunner.syntaxError', { message: (err as Error).message }),
			});
			return;
		}
		try {
			const output = fn(response);
			resolve({ ok: true, output });
		} catch (err) {
			resolve({
				ok: false,
				error: i18n.t('ruleEditor:scriptRunner.runtimeError', { message: (err as Error).message }),
			});
		}
	});
}

function runViaIframe(
	runner: IframeRunner,
	script: string,
	response: unknown,
	timeoutMs: number,
): Promise<AdvancedScriptResult> {
	return new Promise((resolve) => {
		const id = newRequestId();
		const timer = window.setTimeout(() => {
			if (runner.pending.has(id)) {
				runner.pending.delete(id);
				resolve({
					ok: false,
					error: i18n.t('ruleEditor:scriptRunner.timeout', { ms: timeoutMs }),
				});
			}
		}, timeoutMs);
		runner.pending.set(id, (r) => {
			window.clearTimeout(timer);
			resolve(r);
		});
		const target = runner.iframe.contentWindow;
		if (!target) {
			runner.pending.delete(id);
			window.clearTimeout(timer);
			resolve({ ok: false, error: i18n.t('ruleEditor:scriptRunner.sandboxNotReady') });
			return;
		}
		const message: SandboxRequest = { id, script, response };
		target.postMessage(message, '*');
	});
}

export interface RunAdvancedScriptOptions {
	timeoutMs?: number;
	/**
	 * Força o uso de execução direta (apenas para testes — em produção o
	 * CSP da extension page bloqueia `new Function`).
	 */
	forceDirect?: boolean;
}

export async function runAdvancedScript(
	script: string,
	response: unknown,
	options: RunAdvancedScriptOptions = {},
): Promise<AdvancedScriptResult> {
	const timeoutMs = options.timeoutMs ?? 5000;

	if (script.trim().length === 0) {
		return { ok: false, error: i18n.t('ruleEditor:scriptRunner.emptyScript') };
	}

	if (options.forceDirect || (canUseDirectEval() && !getSandboxUrl())) {
		return runDirect(script, response);
	}

	const runner = ensureIframeRunner();
	if (runner) return runViaIframe(runner, script, response, timeoutMs);

	if (canUseDirectEval()) return runDirect(script, response);

	return {
		ok: false,
		error: i18n.t('ruleEditor:scriptRunner.unavailable'),
	};
}

/**
 * Util para testes — limpa estado de módulo entre suites.
 */
export function __resetAdvancedScriptRunnerForTests(): void {
	if (iframeRunner) {
		iframeRunner.iframe.remove();
		iframeRunner = null;
	}
	detectedDirectEval = null;
}

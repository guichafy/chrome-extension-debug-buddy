export {};

// Bridge entre o service worker (background.ts) e o sandbox de execução de
// JavaScript (`sandbox.html`).
//
// Por que existe: o service worker do MV3 não tem `document` nem `window`,
// então não consegue criar um iframe nem usar `new Function` (CSP). A página
// `sandbox.html` é declarada como `sandbox.pages` no manifest — Chrome a
// serve em origem nula com CSP relaxado, permitindo `new Function`. Mas só
// pode ser instanciada via iframe a partir de uma página da extensão.
//
// Esta página `offscreen.html` é criada via `chrome.offscreen.createDocument`
// pelo background, hospeda o iframe do sandbox e expõe um canal de mensagens
// (`chrome.runtime.sendMessage`) que o service worker pode usar.
//
// Protocolo: `{ target: 'offscreen', action: 'runAdvancedTransform', script,
// response, timeoutMs? }` → resposta `AdvancedScriptResult`.
// O background envia com `target: 'offscreen'` para que seu próprio listener
// possa ignorar a mensagem (early-return) e não competir pelo `sendResponse`.

interface SandboxReplyShape {
	id: string;
	ok: boolean;
	output?: unknown;
	error?: string;
}

interface RunAdvancedTransformMessage {
	target: 'offscreen';
	action: 'runAdvancedTransform';
	id: string;
	script: string;
	response: unknown;
	timeoutMs?: number;
}

interface OffscreenReply {
	ok: boolean;
	output?: unknown;
	error?: string;
}

const SANDBOX_PATH = 'sandbox.html';
const READY_SIGNAL = 'debug-buddy-sandbox-ready';

let sandboxIframe: HTMLIFrameElement | null = null;
let sandboxReady = false;
const queuedSends: Array<() => void> = [];
const pending = new Map<string, (reply: OffscreenReply) => void>();

function ensureSandbox(): HTMLIFrameElement {
	if (sandboxIframe) return sandboxIframe;
	const iframe = document.createElement('iframe');
	iframe.src = chrome.runtime.getURL(SANDBOX_PATH);
	iframe.setAttribute('aria-hidden', 'true');
	iframe.title = 'debug-buddy-transform-sandbox';
	iframe.style.cssText = 'position:absolute;width:0;height:0;border:0;visibility:hidden;';
	document.body.appendChild(iframe);
	sandboxIframe = iframe;
	return iframe;
}

function flushQueue(): void {
	while (queuedSends.length > 0) {
		const next = queuedSends.shift();
		if (next) next();
	}
}

window.addEventListener('message', (event: MessageEvent) => {
	const data = event.data;
	if (data && typeof data === 'object' && (data as { type?: unknown }).type === READY_SIGNAL) {
		sandboxReady = true;
		flushQueue();
		return;
	}
	if (!data || typeof data !== 'object') return;
	const reply = data as Partial<SandboxReplyShape>;
	if (typeof reply.id !== 'string') return;
	const cb = pending.get(reply.id);
	if (!cb) return;
	pending.delete(reply.id);
	if (reply.ok === true) {
		cb({ ok: true, output: reply.output });
	} else {
		cb({
			ok: false,
			error: typeof reply.error === 'string' ? reply.error : 'Erro desconhecido no sandbox',
		});
	}
});

function isRunAdvancedTransformMessage(value: unknown): value is RunAdvancedTransformMessage {
	if (typeof value !== 'object' || value === null) return false;
	const v = value as Record<string, unknown>;
	return (
		v.target === 'offscreen' &&
		v.action === 'runAdvancedTransform' &&
		typeof v.id === 'string' &&
		typeof v.script === 'string' &&
		'response' in v
	);
}

chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
	if (!isRunAdvancedTransformMessage(message)) return false;

	const iframe = ensureSandbox();
	const timeoutMs = message.timeoutMs ?? 5000;

	const timer = setTimeout(() => {
		if (pending.has(message.id)) {
			pending.delete(message.id);
			sendResponse({
				ok: false,
				error: `Timeout: sandbox não respondeu em ${timeoutMs}ms`,
			} satisfies OffscreenReply);
		}
	}, timeoutMs);

	pending.set(message.id, (reply) => {
		clearTimeout(timer);
		sendResponse(reply);
	});

	const send = () => {
		const target = iframe.contentWindow;
		if (!target) {
			clearTimeout(timer);
			pending.delete(message.id);
			sendResponse({
				ok: false,
				error: 'Sandbox não inicializado: contentWindow ausente',
			} satisfies OffscreenReply);
			return;
		}
		target.postMessage({ id: message.id, script: message.script, response: message.response }, '*');
	};

	if (sandboxReady) {
		send();
	} else {
		queuedSends.push(send);
		// Fallback: se o ready signal nunca chegar, tenta após o load do iframe.
		iframe.addEventListener(
			'load',
			() => {
				if (!sandboxReady) {
					sandboxReady = true;
					flushQueue();
				}
			},
			{ once: true },
		);
	}

	return true; // resposta assíncrona
});

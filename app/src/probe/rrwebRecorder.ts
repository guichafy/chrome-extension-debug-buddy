// Content script ISOLATED que liga rrweb-record e flusha eventos pro background.
// Roda em todas as URLs (matches: <all_urls>) com run_at: document_start. Espera
// `__rrweb_start` antes de iniciar a captura — sem isso, fica idle (sem overhead).

import { record } from 'rrweb';
import type { recordOptions } from 'rrweb';
import type { eventWithTime } from '@rrweb/types';

// `recordOptions<T>` em rrweb v2 é `T | undefined` (matching `record(opts?)`).
// `NonNullable<...>` força o tipo concreto pra que `buildRrwebOptions()` não
// devolva `... | undefined` — facilita testes e clareia a API.
type RrwebRecordOptions = NonNullable<recordOptions<eventWithTime>>;

const FLUSH_INTERVAL_MS = 1000;
const FLUSH_BATCH_SIZE = 100;

let buffer: eventWithTime[] = [];
// Função `stop` retornada por rrweb.record(); usar `null` quando idle.
// Não confundir com `stopRecordingNow()` (handler do `__rrweb_stop`).
let rrwebStopFn: (() => void) | null = null;
let flushTimer: number | null = null;
let activeSessionId: string | null = null;

export interface RrwebMaskOpts {
	maskTextSelector: string;
	maskAllInputs: boolean;
	recordCanvas: boolean;
	emit: NonNullable<RrwebRecordOptions['emit']>;
}

// Helper puro testável — monta o objeto de opções de rrweb.record() a partir
// das flags de privacidade. Não chama record() diretamente.
export function buildRrwebOptions(opts: RrwebMaskOpts): RrwebRecordOptions {
	const allInputs = {
		password: true,
		color: true,
		date: true,
		'datetime-local': true,
		email: true,
		month: true,
		number: true,
		range: true,
		search: true,
		tel: true,
		text: true,
		time: true,
		url: true,
		week: true,
		textarea: true,
		select: true,
	};
	const passwordOnly = { password: true };
	return {
		emit: opts.emit,
		recordCanvas: opts.recordCanvas,
		maskTextSelector: opts.maskTextSelector,
		maskInputOptions: opts.maskAllInputs ? allInputs : passwordOnly,
		maskInputFn: (text: string, element: HTMLElement | null) => {
			const ac = (element as HTMLInputElement | null)?.getAttribute?.('autocomplete') ?? '';
			if (ac.startsWith('cc-')) return '[REDACTED]';
			return text;
		},
	};
}

interface StartOpts {
	recordCanvas: boolean;
	maskTextSelector: string;
	maskAllInputs: boolean;
}

function flush(): void {
	if (buffer.length === 0) return;
	if (activeSessionId === null) {
		// Defesa: sem sessionId, não há onde gravar — descarta para não vazar bytes.
		buffer = [];
		return;
	}
	const batch = buffer;
	buffer = [];
	chrome.runtime
		.sendMessage({
			action: 'rrwebBatch',
			sessionId: activeSessionId,
			rrwebEvents: batch,
		})
		.catch((err: unknown) => {
			// Canal invalidado quando a extensão é recarregada — silenciar.
			if (String(err).includes('Extension context invalidated')) return;
			console.warn('[rrweb] flush falhou:', err);
		});
}

function scheduleFlush(): void {
	if (flushTimer !== null) return;
	flushTimer = window.setTimeout(() => {
		flushTimer = null;
		flush();
	}, FLUSH_INTERVAL_MS);
}

function startRecording(sessionId: string, opts: StartOpts): void {
	if (rrwebStopFn && activeSessionId === sessionId) {
		// Mesma sessão, mesmo documento — start redundante (retry / misfire de
		// webNavigation). Ignora para não derrubar buffer e perder eventos.
		return;
	}
	if (rrwebStopFn) {
		// Já gravando outra sessão / documento — provavelmente re-injeção pós-navegação.
		// Atualiza sessionId e reinicia para gerar FullSnapshot do novo documento.
		rrwebStopFn();
		rrwebStopFn = null;
		buffer = [];
	}
	// IMPORTANTE: definir activeSessionId ANTES de chamar record(). rrweb dispara
	// o FullSnapshot sincronicamente dentro de record(), e o emit precisa do
	// sessionId já populado para não cair no branch de descarte do flush().
	activeSessionId = sessionId;
	const stop = record(
		buildRrwebOptions({
			maskTextSelector: opts.maskTextSelector,
			maskAllInputs: opts.maskAllInputs,
			recordCanvas: opts.recordCanvas,
			emit(event: eventWithTime) {
				buffer.push(event);
				if (buffer.length >= FLUSH_BATCH_SIZE) {
					if (flushTimer !== null) {
						clearTimeout(flushTimer);
						flushTimer = null;
					}
					flush();
					return;
				}
				scheduleFlush();
			},
		}),
	);
	if (!stop) {
		// rrweb retorna undefined quando já há gravação ativa no mesmo doc —
		// nunca deveria acontecer porque limpamos `rrwebStopFn` acima.
		throw new Error('[rrweb] record() retornou undefined inesperadamente');
	}
	rrwebStopFn = stop;
}

function stopRecordingNow(): void {
	if (rrwebStopFn) {
		rrwebStopFn();
		rrwebStopFn = null;
	}
	if (flushTimer !== null) {
		clearTimeout(flushTimer);
		flushTimer = null;
	}
	flush(); // último batch
	activeSessionId = null;
	buffer = [];
}

chrome.runtime.onMessage.addListener((message, _sender, _sendResponse) => {
	if (message?.action === '__rrweb_start') {
		const sid = message.sessionId;
		const recordCanvas = !!message.recordCanvas;
		const maskTextSelector =
			typeof message.maskTextSelector === 'string'
				? message.maskTextSelector
				: '.dbb-mask, [data-dbb-mask]';
		const maskAllInputs = !!message.maskAllInputs;
		if (typeof sid !== 'string' || sid.length === 0) {
			console.warn('[rrweb] __rrweb_start sem sessionId válido — ignorado');
			return false;
		}
		try {
			startRecording(sid, { recordCanvas, maskTextSelector, maskAllInputs });
		} catch (err) {
			console.warn('[rrweb] startRecording falhou:', err);
		}
	} else if (message?.action === '__rrweb_stop') {
		stopRecordingNow();
	}
	return false;
});

// Flush antes de a tab fechar (best-effort — service worker pode não receber).
window.addEventListener('pagehide', () => {
	if (rrwebStopFn) {
		flush();
	}
});

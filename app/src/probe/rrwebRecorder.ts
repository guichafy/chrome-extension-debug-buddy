// Content script ISOLATED que liga rrweb-record e flusha eventos pro background.
// Roda em todas as URLs (matches: <all_urls>) com run_at: document_start. Espera
// `__rrweb_start` antes de iniciar a captura — sem isso, fica idle (sem overhead).

import { record } from 'rrweb';
import type { eventWithTime } from '@rrweb/types';

const FLUSH_INTERVAL_MS = 1000;
const FLUSH_BATCH_SIZE = 100;

let buffer: eventWithTime[] = [];
// Função `stop` retornada por rrweb.record(); usar `null` quando idle.
// Não confundir com `stopRecordingNow()` (handler do `__rrweb_stop`).
let rrwebStopFn: (() => void) | null = null;
let flushTimer: number | null = null;
let activeSessionId: string | null = null;

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

function startRecording(sessionId: string, recordCanvas: boolean): void {
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
	const stop = record({
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
		recordCanvas,
	});
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
		if (typeof sid !== 'string' || sid.length === 0) {
			console.warn('[rrweb] __rrweb_start sem sessionId válido — ignorado');
			return false;
		}
		try {
			startRecording(sid, recordCanvas);
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

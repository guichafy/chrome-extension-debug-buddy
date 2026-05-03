// Adapter puro: traduz `SessionEvent` (variante network) em estruturas
// consumíveis pelo Replay. O cutoffTimestamp é inclusivo para sincronizar com o
// playhead do rrweb-player.

import type { InterceptedResponse } from '@/types/intercepted';
import type { SessionEvent } from './types';

/**
 * Cria uma cópia "slim" do InterceptedResponse sem body/postData fields para
 * embedar no SessionEvent. Replay table só lê metadados (url/method/status/
 * mimeType/duration/etc) — body seria dezenas a centenas de KB por request,
 * inflando a sessão até crash em ~120 requests. Strip preserva a paridade
 * visual com Command Center (colunas) sem o custo de IDB.
 *
 * Idempotente: aplicar em InterceptedResponse já slim retorna outra cópia
 * slim sem perda de informação.
 */
export function stripBodyFields(r: InterceptedResponse): InterceptedResponse {
	const slim: InterceptedResponse = {
		url: r.url,
		method: r.method,
		status: r.status,
		statusText: r.statusText,
		headers: r.headers,
		mimeType: r.mimeType,
		type: r.type,
		timestamp: r.timestamp,
		isWaiting: r.isWaiting,
		isMocked: r.isMocked,
		isTransformed: r.isTransformed,
		captureError: r.captureError,
		bodyUnavailableReason: r.bodyUnavailableReason,
		duration: r.duration,
		durationSource: r.durationSource,
		mockLatencyMs: r.mockLatencyMs,
		networkTiming: r.networkTiming,
		generatedRuleId: r.generatedRuleId,
		editedAtRuntime: r.editedAtRuntime,
		appliedTypes: r.appliedTypes,
		delayMs: r.delayMs,
		// body, response, request: omitidos intencionalmente — não cabem na sessão.
	};
	return slim;
}

/**
 * Mapeia eventos network → Record<id, InterceptedResponse> esperado pelo
 * RequestTimeline do Command Center. Filtra por cutoff inclusivo. Eventos
 * sem `request` snapshot (sessões pré-Fase 7) são omitidos — não fabricamos.
 */
export function sessionEventsToRequestsRecord(
	events: SessionEvent[],
	cutoffTimestamp: number,
): Record<string, InterceptedResponse> {
	const out: Record<string, InterceptedResponse> = {};
	for (const ev of events) {
		if (ev.type !== 'network') continue;
		if (ev.timestamp > cutoffTimestamp) continue;
		if (!ev.request) continue;
		out[ev.requestId] = ev.request;
	}
	return out;
}

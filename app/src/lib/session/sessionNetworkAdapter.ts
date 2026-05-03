// Adapter puro: traduz `SessionEvent` (variante network) em estruturas
// consumíveis pelo Replay. O cutoffTimestamp é inclusivo para sincronizar com o
// playhead do rrweb-player.

import type { InterceptedResponse } from '@/types/intercepted';
import type { SessionEvent } from './types';

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

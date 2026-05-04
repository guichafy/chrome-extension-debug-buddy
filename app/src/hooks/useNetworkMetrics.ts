import { useMemo } from 'react';
import { type MetricsAggregate, aggregateRequests, filterBySession } from '@/lib/networkMetrics';
import type { InterceptedResponse } from '@/types/intercepted';
import type { SessionMarker } from '@/types/sessionMarker';

// Hook puro: derivado de allRequests + sessionMarker. Memoizado para evitar
// agregar a cada render — só recompõe quando uma das duas referências muda.
//
// Histórico: antes expunha também `currentPage` e detalhes ricos por pílula
// (Top transferências, TTFB p50/p95, falhas, etc.). Foi descontinuado em prol
// de uma barra estilo "footer do Chrome DevTools": session-only, três pills.

export interface NetworkMetricsResult {
	session: MetricsAggregate;
}

export function useNetworkMetrics(
	allRequests: Record<string, InterceptedResponse>,
	sessionMarker: SessionMarker,
): NetworkMetricsResult {
	return useMemo(() => {
		const sessionList = filterBySession(allRequests, sessionMarker.sessionStartedAt);
		return {
			session: aggregateRequests(sessionList),
		};
	}, [allRequests, sessionMarker]);
}

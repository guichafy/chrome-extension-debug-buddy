import { useMemo } from 'react';
import {
	type MetricsAggregate,
	aggregateRequests,
	filterByCurrentPage,
	filterBySession,
} from '@/lib/networkMetrics';
import type { InterceptedResponse } from '@/types/intercepted';
import type { SessionMarker } from '@/types/sessionMarker';

// Hook puro: derivado de allRequests + sessionMarker. Memoizado para evitar
// agregar a cada render — só recompõe quando uma das duas referências muda.

export interface NetworkMetricsResult {
	session: MetricsAggregate;
	currentPage: MetricsAggregate;
}

export function useNetworkMetrics(
	allRequests: Record<string, InterceptedResponse>,
	sessionMarker: SessionMarker,
): NetworkMetricsResult {
	return useMemo(() => {
		const session = aggregateRequests(filterBySession(allRequests, sessionMarker.sessionStartedAt));
		const currentPage = aggregateRequests(
			filterByCurrentPage(allRequests, sessionMarker.currentPageNavigatedAt),
		);
		return { session, currentPage };
	}, [allRequests, sessionMarker]);
}

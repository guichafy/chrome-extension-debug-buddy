import { useMemo } from 'react';
import {
	type MetricsAggregate,
	aggregateRequests,
	filterByCurrentPage,
	filterBySession,
} from '@/lib/networkMetrics';
import {
	type BytesDetail,
	type FailedDetail,
	type SlowDetail,
	type TotalDetail,
	type TtfbDetail,
	detailBytes,
	detailFailed,
	detailSlow,
	detailTotal,
	detailTtfb,
} from '@/lib/networkPillsDetail';
import type { InterceptedResponse } from '@/types/intercepted';
import type { SessionMarker } from '@/types/sessionMarker';

// Hook puro: derivado de allRequests + sessionMarker. Memoizado para evitar
// agregar a cada render — só recompõe quando uma das duas referências muda.

export interface PillsDetail {
	total: TotalDetail;
	bytes: BytesDetail;
	ttfb: TtfbDetail | null;
	slow: SlowDetail;
	failed: FailedDetail;
}

export interface NetworkMetricsResult {
	session: MetricsAggregate;
	currentPage: MetricsAggregate;
	sessionDetails: PillsDetail;
	currentPageDetails: PillsDetail;
}

function buildDetails(requests: InterceptedResponse[]): PillsDetail {
	return {
		total: detailTotal(requests),
		bytes: detailBytes(requests),
		ttfb: detailTtfb(requests),
		slow: detailSlow(requests),
		failed: detailFailed(requests),
	};
}

export function useNetworkMetrics(
	allRequests: Record<string, InterceptedResponse>,
	sessionMarker: SessionMarker,
): NetworkMetricsResult {
	return useMemo(() => {
		const sessionList = filterBySession(allRequests, sessionMarker.sessionStartedAt);
		const pageList = filterByCurrentPage(allRequests, sessionMarker.currentPageNavigatedAt);
		return {
			session: aggregateRequests(sessionList),
			currentPage: aggregateRequests(pageList),
			sessionDetails: buildDetails(sessionList),
			currentPageDetails: buildDetails(pageList),
		};
	}, [allRequests, sessionMarker]);
}

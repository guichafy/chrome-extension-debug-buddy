// Funções puras de agregação para o NetworkMetricsBar do header.
// O hook `useNetworkMetrics` consome estas funções; o background não usa.
//
// Regra do projeto (no-fallback): quando uma métrica depende de dados
// que podem estar ausentes (ttfbMs, transferSize), retornamos `null` ao
// invés de `0` para a UI distinguir "nenhum dado" de "tudo zerado".

import type { InterceptedResponse } from '@/types/intercepted';

export const SLOW_THRESHOLD_MS = 1000;

export interface MetricsAggregate {
	totalRequests: number;
	totalBytes: number | null;
	avgTtfbMs: number | null;
	slowCount: number;
	failedCount: number;
}

export function aggregateRequests(requests: InterceptedResponse[]): MetricsAggregate {
	let totalBytes: number | null = null;
	let ttfbSum = 0;
	let ttfbCount = 0;
	let slowCount = 0;
	let failedCount = 0;

	for (const r of requests) {
		const transferSize = r.networkTiming?.transferSize;
		if (typeof transferSize === 'number') {
			totalBytes = (totalBytes ?? 0) + transferSize;
		}
		const ttfbMs = r.networkTiming?.ttfbMs;
		if (typeof ttfbMs === 'number') {
			ttfbSum += ttfbMs;
			ttfbCount += 1;
		}
		if (typeof r.duration === 'number' && r.duration > SLOW_THRESHOLD_MS) slowCount += 1;
		if ((typeof r.status === 'number' && r.status >= 400) || r.captureError) failedCount += 1;
	}

	const avgTtfbMs = ttfbCount === 0 ? null : Math.round(ttfbSum / ttfbCount);

	return {
		totalRequests: requests.length,
		totalBytes,
		avgTtfbMs,
		slowCount,
		failedCount,
	};
}

export function filterBySession(
	requests: Record<string, InterceptedResponse>,
	sessionStartedAt: number | null,
): InterceptedResponse[] {
	if (sessionStartedAt == null) return [];
	const out: InterceptedResponse[] = [];
	for (const r of Object.values(requests)) {
		if (r && typeof r.timestamp === 'number' && r.timestamp >= sessionStartedAt) out.push(r);
	}
	return out;
}

export function filterByCurrentPage(
	requests: Record<string, InterceptedResponse>,
	currentPageNavigatedAt: number | null,
): InterceptedResponse[] {
	if (currentPageNavigatedAt == null) return [];
	const out: InterceptedResponse[] = [];
	for (const r of Object.values(requests)) {
		if (r && typeof r.timestamp === 'number' && r.timestamp >= currentPageNavigatedAt) out.push(r);
	}
	return out;
}

// Funções puras de agregação para o NetworkMetricsBar do header.
// O hook `useNetworkMetrics` consome estas funções; o background não usa.
//
// Regra do projeto (no-fallback): quando uma métrica depende de dados
// que podem estar ausentes (ttfbMs, transferSize, body), retornamos `null`
// ao invés de `0` para a UI distinguir "nenhum dado" de "tudo zerado".

import type { InterceptedResponse } from '@/types/intercepted';

export const SLOW_THRESHOLD_MS = 1000;

export interface MetricsAggregate {
	totalRequests: number;
	/** Soma de bytes "no fio" (CDP `transferSize`). `null` quando nenhuma request reportou. */
	totalBytes: number | null;
	/**
	 * Soma de bytes dos response bodies decodificados que conseguimos capturar.
	 * Aproxima a métrica "resources" do footer do Chrome DevTools dentro do que
	 * a extensão efetivamente armazena (bodies binários ou acima do cap ficam
	 * ausentes — viram `bodyUnavailableReason`). `null` quando nenhuma request
	 * teve body capturado.
	 */
	totalResourceBytes: number | null;
	avgTtfbMs: number | null;
	slowCount: number;
	failedCount: number;
}

const textEncoder = typeof TextEncoder === 'undefined' ? null : new TextEncoder();

function bodyByteSize(body: string | undefined): number | null {
	if (typeof body !== 'string' || body.length === 0) return null;
	if (textEncoder) return textEncoder.encode(body).length;
	// Fallback para ambientes sem TextEncoder (raro): comprimento da string em
	// chars. Subestima bytes em UTF-8 multibyte, mas é melhor do que falhar.
	return body.length;
}

export function aggregateRequests(requests: InterceptedResponse[]): MetricsAggregate {
	let totalBytes: number | null = null;
	let totalResourceBytes: number | null = null;
	let ttfbSum = 0;
	let ttfbCount = 0;
	let slowCount = 0;
	let failedCount = 0;

	for (const r of requests) {
		const transferSize = r.networkTiming?.transferSize;
		if (typeof transferSize === 'number') {
			totalBytes = (totalBytes ?? 0) + transferSize;
		}
		const bodySize = bodyByteSize(r.response?.body ?? r.body);
		if (bodySize !== null) {
			totalResourceBytes = (totalResourceBytes ?? 0) + bodySize;
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
		totalResourceBytes,
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

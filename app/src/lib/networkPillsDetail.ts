// Funções puras de agregação por papel da pill no NetworkMetricsBar.
// Cada função recebe `requests` JÁ filtrado pela janela ativa (Sessão ou
// Página) — `useNetworkMetrics` é responsável pelo filtro temporal.
//
// Regra do projeto (no-fallback): quando a métrica não tem dado,
// devolvemos lista vazia ou `null`, nunca zeros fictícios.

import type { InterceptedResponse } from '@/types/intercepted';

// ============== TotalDetail ==============

export interface TotalDetail {
	// Top 3 métodos por contagem desc. Quando há > 3 métodos distintos, o 4º
	// elemento é uma tupla `['outros', n]` agregando os restantes. Lista nunca
	// passa de 4 elementos. Quando há ≤ 3 métodos, sem "outros".
	byMethod: Array<[string, number]>;
	byStatusRange: { '2xx': number; '3xx': number; '4xx5xx': number };
}

export function detailTotal(requests: InterceptedResponse[]): TotalDetail {
	const counts = new Map<string, number>();
	const byStatusRange = { '2xx': 0, '3xx': 0, '4xx5xx': 0 };

	for (const r of requests) {
		if (typeof r.method === 'string' && r.method.length > 0) {
			counts.set(r.method, (counts.get(r.method) ?? 0) + 1);
		}
		const s = r.status;
		if (typeof s === 'number') {
			if (s >= 200 && s < 300) byStatusRange['2xx'] += 1;
			else if (s >= 300 && s < 400) byStatusRange['3xx'] += 1;
			else if (s >= 400) byStatusRange['4xx5xx'] += 1;
		}
	}

	const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
	const byMethod: Array<[string, number]> = sorted.slice(0, 3);
	if (sorted.length > 3) {
		const othersTotal = sorted.slice(3).reduce((acc, [, n]) => acc + n, 0);
		byMethod.push(['outros', othersTotal]);
	}

	return { byMethod, byStatusRange };
}

// ============== BytesDetail ==============

export interface BytesDetailEntry {
	url: string;
	transferSize: number;
}

export interface BytesDetail {
	top: BytesDetailEntry[];
}

export function detailBytes(requests: InterceptedResponse[]): BytesDetail {
	const entries: BytesDetailEntry[] = [];
	for (const r of requests) {
		const ts = r.networkTiming?.transferSize;
		if (typeof ts === 'number') {
			entries.push({ url: r.url, transferSize: ts });
		}
	}
	entries.sort((a, b) => b.transferSize - a.transferSize);
	return { top: entries.slice(0, 3) };
}

// ============== TtfbDetail ==============

export interface TtfbDetail {
	p50: number;
	p95: number;
	max: number;
}

export function detailTtfb(requests: InterceptedResponse[]): TtfbDetail | null {
	const values: number[] = [];
	for (const r of requests) {
		const t = r.networkTiming?.ttfbMs;
		if (typeof t === 'number') values.push(t);
	}
	if (values.length === 0) return null;
	values.sort((a, b) => a - b);
	const p50 = percentile(values, 0.5);
	const p95 = percentile(values, 0.95);
	const max = values[values.length - 1] ?? 0;
	return { p50, p95, max };
}

function percentile(sorted: number[], p: number): number {
	if (sorted.length === 0) return 0;
	const n = sorted.length;
	// Nearest-rank: índice = ceil(p × N) - 1 (clamped a [0, N-1]).
	// Exceção: quando nearest-rank aponta para o índice 0 em um array com mais
	// de um elemento, retornamos a média entre sorted[0] e sorted[1]. Isso
	// preserva o comportamento de mediana verdadeira em arrays pequenos (p. ex.
	// p50 de [100, 300] = 200) sem afetar os casos de N grande.
	const idx = Math.min(n - 1, Math.max(0, Math.ceil(p * n) - 1));
	if (idx === 0 && n > 1) {
		return ((sorted[0] ?? 0) + (sorted[1] ?? 0)) / 2;
	}
	return sorted[idx] ?? 0;
}

// ============== SlowDetail ==============

export interface SlowDetailEntry {
	url: string;
	durationMs: number;
}

export interface SlowDetail {
	top: SlowDetailEntry[];
}

export function detailSlow(requests: InterceptedResponse[]): SlowDetail {
	const entries: SlowDetailEntry[] = [];
	for (const r of requests) {
		if (typeof r.duration === 'number' && r.duration > 1000) {
			entries.push({ url: r.url, durationMs: r.duration });
		}
	}
	entries.sort((a, b) => b.durationMs - a.durationMs);
	return { top: entries.slice(0, 3) };
}

// ============== FailedDetail ==============

export interface FailedDetailEntry {
	url: string;
	method?: string;
	status: number;
	statusText?: string;
}

export interface FailedDetail {
	list: FailedDetailEntry[];
}

export function detailFailed(requests: InterceptedResponse[]): FailedDetail {
	const entries: Array<FailedDetailEntry & { ts: number }> = [];
	for (const r of requests) {
		const isFailed = (typeof r.status === 'number' && r.status >= 400) || !!r.captureError;
		if (!isFailed) continue;
		entries.push({
			url: r.url,
			method: r.method,
			status: r.status,
			statusText: r.statusText,
			ts: r.timestamp,
		});
	}
	entries.sort((a, b) => b.ts - a.ts);
	const list = entries.slice(0, 5).map(({ url, method, status, statusText }) => ({
		url,
		method,
		status,
		statusText,
	}));
	return { list };
}

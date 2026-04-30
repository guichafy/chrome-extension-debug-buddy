import type { InterceptedResponse } from '@/types/intercepted';
import {
	SLOW_THRESHOLD_MS,
	aggregateRequests,
	filterByCurrentPage,
	filterBySession,
} from '../networkMetrics';

function req(overrides: Partial<InterceptedResponse> = {}): InterceptedResponse {
	return {
		url: 'https://example.com/',
		status: 200,
		statusText: 'OK',
		headers: {},
		type: 'XHR',
		timestamp: 1000,
		...overrides,
	};
}

describe('aggregateRequests', () => {
	it('retorna zeros e nulls para lista vazia', () => {
		expect(aggregateRequests([])).toEqual({
			totalRequests: 0,
			totalBytes: null,
			avgTtfbMs: null,
			slowCount: 0,
			failedCount: 0,
		});
	});

	it('soma totalBytes só de requests com networkTiming.transferSize', () => {
		const requests = [
			req({ networkTiming: { transferSize: 1000 } }),
			req({ networkTiming: { transferSize: 2500 } }),
			req({}), // sem networkTiming → ignorada na soma
		];
		expect(aggregateRequests(requests)).toMatchObject({
			totalRequests: 3,
			totalBytes: 3500,
		});
	});

	it('totalBytes é null quando nenhuma request tem transferSize', () => {
		const requests = [req({ networkTiming: { fromDiskCache: true } }), req({})];
		expect(aggregateRequests(requests).totalBytes).toBeNull();
	});

	it('avgTtfbMs é média sobre requests com ttfbMs definido', () => {
		const requests = [
			req({ networkTiming: { ttfbMs: 100 } }),
			req({ networkTiming: { ttfbMs: 300 } }),
			req({}),
		];
		expect(aggregateRequests(requests).avgTtfbMs).toBe(200);
	});

	it('avgTtfbMs é null quando nenhuma request tem ttfbMs', () => {
		const requests = [req({ networkTiming: { transferSize: 100 } }), req({})];
		expect(aggregateRequests(requests).avgTtfbMs).toBeNull();
	});

	it('slowCount conta apenas duration > SLOW_THRESHOLD_MS', () => {
		const requests = [
			req({ duration: 999 }),
			req({ duration: 1000 }), // borda inclusiva → NÃO conta como lenta
			req({ duration: 1001 }),
			req({ duration: 5000 }),
			req({}), // sem duration → não conta nem como rápida nem como lenta
		];
		expect(aggregateRequests(requests).slowCount).toBe(2);
	});

	it('failedCount conta status >= 400 OU captureError não-vazio', () => {
		const requests = [
			req({ status: 200 }),
			req({ status: 304 }),
			req({ status: 400 }),
			req({ status: 500 }),
			req({ status: 200, captureError: 'oops' }),
		];
		expect(aggregateRequests(requests).failedCount).toBe(3);
	});

	it('SLOW_THRESHOLD_MS é 1000', () => {
		expect(SLOW_THRESHOLD_MS).toBe(1000);
	});
});

describe('filterBySession', () => {
	it('retorna lista vazia quando sessionStartedAt é null', () => {
		const all = { a: req({ timestamp: 100 }), b: req({ timestamp: 200 }) };
		expect(filterBySession(all, null)).toEqual([]);
	});

	it('retorna requests com timestamp >= sessionStartedAt', () => {
		const all = {
			a: req({ timestamp: 100 }),
			b: req({ timestamp: 500 }),
			c: req({ timestamp: 999 }),
		};
		const result = filterBySession(all, 500);
		expect(result.map((r) => r.timestamp).sort()).toEqual([500, 999]);
	});
});

describe('filterByCurrentPage', () => {
	it('retorna lista vazia quando currentPageNavigatedAt é null', () => {
		const all = { a: req({ timestamp: 100 }) };
		expect(filterByCurrentPage(all, null)).toEqual([]);
	});

	it('retorna requests com timestamp >= currentPageNavigatedAt', () => {
		const all = {
			a: req({ timestamp: 100 }),
			b: req({ timestamp: 500 }),
		};
		const result = filterByCurrentPage(all, 500);
		expect(result.map((r) => r.timestamp)).toEqual([500]);
	});
});

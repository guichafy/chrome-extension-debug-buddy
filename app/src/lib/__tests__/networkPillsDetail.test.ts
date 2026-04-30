import type { InterceptedResponse } from '@/types/intercepted';
import {
	detailBytes,
	detailFailed,
	detailSlow,
	detailTotal,
	detailTtfb,
} from '../networkPillsDetail';

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

describe('detailTotal', () => {
	it('vazio retorna estruturas zeradas', () => {
		expect(detailTotal([])).toEqual({
			byMethod: [],
			byStatusRange: { '2xx': 0, '3xx': 0, '4xx5xx': 0 },
		});
	});

	it('agrupa por método e ordena desc', () => {
		const r = [
			req({ method: 'GET' }),
			req({ method: 'GET' }),
			req({ method: 'GET' }),
			req({ method: 'POST' }),
			req({ method: 'POST' }),
			req({ method: 'OPTIONS' }),
		];
		expect(detailTotal(r).byMethod).toEqual([
			['GET', 3],
			['POST', 2],
			['OPTIONS', 1],
		]);
	});

	it('colapsa métodos além do top 3 em "outros"', () => {
		const r = [
			req({ method: 'GET' }),
			req({ method: 'GET' }),
			req({ method: 'POST' }),
			req({ method: 'OPTIONS' }),
			req({ method: 'PUT' }),
			req({ method: 'DELETE' }),
		];
		// top 3: GET=2, POST=1, OPTIONS=1; outros: PUT+DELETE=2
		const result = detailTotal(r).byMethod;
		expect(result).toHaveLength(4);
		expect(result[0]).toEqual(['GET', 2]);
		expect(result[3]).toEqual(['outros', 2]);
	});

	it('classifica status em 2xx/3xx/4xx5xx', () => {
		const r = [
			req({ status: 200 }),
			req({ status: 204 }),
			req({ status: 301 }),
			req({ status: 404 }),
			req({ status: 500 }),
		];
		expect(detailTotal(r).byStatusRange).toEqual({ '2xx': 2, '3xx': 1, '4xx5xx': 2 });
	});

	it('ignora método ausente (não conta)', () => {
		const r = [req({ method: undefined }), req({ method: 'GET' })];
		expect(detailTotal(r).byMethod).toEqual([['GET', 1]]);
	});
});

describe('detailBytes', () => {
	it('vazio retorna lista vazia', () => {
		expect(detailBytes([])).toEqual({ top: [] });
	});

	it('top 3 por transferSize desc, ignora requests sem transferSize', () => {
		const r = [
			req({ url: 'https://a/', networkTiming: { transferSize: 500 } }),
			req({ url: 'https://b/', networkTiming: { transferSize: 1500 } }),
			req({ url: 'https://c/', networkTiming: { transferSize: 800 } }),
			req({ url: 'https://d/', networkTiming: { transferSize: 100 } }),
			req({ url: 'https://e/' }), // sem transferSize → ignorada
		];
		expect(detailBytes(r).top).toEqual([
			{ url: 'https://b/', transferSize: 1500 },
			{ url: 'https://c/', transferSize: 800 },
			{ url: 'https://a/', transferSize: 500 },
		]);
	});
});

describe('detailTtfb', () => {
	it('retorna null quando ninguém tem ttfbMs', () => {
		expect(detailTtfb([req(), req()])).toBeNull();
	});

	it('calcula p50/p95/max em conjunto pequeno', () => {
		const r = [
			req({ networkTiming: { ttfbMs: 100 } }),
			req({ networkTiming: { ttfbMs: 200 } }),
			req({ networkTiming: { ttfbMs: 300 } }),
		];
		const result = detailTtfb(r);
		expect(result).toEqual({ p50: 200, p95: 300, max: 300 });
	});

	it('p95 escolhe percentile correto em conjunto grande', () => {
		// 100 valores: 1..100. p95 é o índice ceil(0.95 * 100) - 1 = 94 → valor 95.
		const r = Array.from({ length: 100 }, (_, i) =>
			req({ networkTiming: { ttfbMs: i + 1 } }),
		);
		const result = detailTtfb(r);
		expect(result?.p50).toBe(50);
		expect(result?.p95).toBe(95);
		expect(result?.max).toBe(100);
	});

	it('ignora requests sem ttfbMs', () => {
		const r = [
			req({ networkTiming: { ttfbMs: 100 } }),
			req(), // sem ttfbMs → ignorada
			req({ networkTiming: { ttfbMs: 300 } }),
		];
		const result = detailTtfb(r);
		expect(result).toEqual({ p50: 200, p95: 300, max: 300 });
	});
});

describe('detailSlow', () => {
	it('retorna lista vazia quando ninguém é > 1000ms', () => {
		const r = [req({ duration: 500 }), req({ duration: 999 })];
		expect(detailSlow(r)).toEqual({ top: [] });
	});

	it('top 3 mais lentas com duration > 1000', () => {
		const r = [
			req({ url: 'https://a/', duration: 1200 }),
			req({ url: 'https://b/', duration: 2400 }),
			req({ url: 'https://c/', duration: 800 }), // < 1000, fora
			req({ url: 'https://d/', duration: 1800 }),
			req({ url: 'https://e/', duration: 1100 }),
		];
		expect(detailSlow(r).top).toEqual([
			{ url: 'https://b/', durationMs: 2400 },
			{ url: 'https://d/', durationMs: 1800 },
			{ url: 'https://a/', durationMs: 1200 },
		]);
	});

	it('ignora request sem duration', () => {
		const r = [req(), req({ duration: 1500 })];
		expect(detailSlow(r).top).toEqual([{ url: 'https://example.com/', durationMs: 1500 }]);
	});
});

describe('detailFailed', () => {
	it('retorna lista vazia quando não há falhas', () => {
		expect(detailFailed([req({ status: 200 })])).toEqual({ list: [] });
	});

	it('inclui status >= 400 e captureError, ordenado por timestamp desc', () => {
		const r = [
			req({ url: 'https://a/', status: 200, timestamp: 100 }),
			req({ url: 'https://b/', status: 404, statusText: 'Not Found', timestamp: 200 }),
			req({
				url: 'https://c/',
				status: 500,
				statusText: 'Internal Server Error',
				timestamp: 300,
			}),
			req({ url: 'https://d/', status: 200, captureError: 'oops', timestamp: 400 }),
		];
		expect(detailFailed(r).list).toEqual([
			{ url: 'https://d/', method: undefined, status: 200, statusText: 'OK' },
			{ url: 'https://c/', method: undefined, status: 500, statusText: 'Internal Server Error' },
			{ url: 'https://b/', method: undefined, status: 404, statusText: 'Not Found' },
		]);
	});

	it('limita a 5 entradas', () => {
		const r = Array.from({ length: 10 }, (_, i) =>
			req({ url: `https://${i}/`, status: 500, timestamp: i * 100 }),
		);
		const result = detailFailed(r);
		expect(result.list).toHaveLength(5);
		// 5 mais recentes: timestamps 9*100, 8*100, ..., 5*100
		expect(result.list[0]?.url).toBe('https://9/');
		expect(result.list[4]?.url).toBe('https://5/');
	});

	it('inclui method quando definido', () => {
		const r = [req({ method: 'POST', status: 401 })];
		expect(detailFailed(r).list[0]?.method).toBe('POST');
	});
});

import type { Sort } from '@/types/filters';
import type { InterceptedResponse } from '@/types/intercepted';
import { compareRequests } from '../networkSort';

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

function sortBy(sort: Sort, items: InterceptedResponse[]): InterceptedResponse[] {
	return [...items].sort(compareRequests(sort));
}

describe('compareRequests', () => {
	it('ordena por timestamp asc', () => {
		const out = sortBy({ field: 'timestamp', dir: 'asc' }, [
			req({ timestamp: 200 }),
			req({ timestamp: 100 }),
			req({ timestamp: 300 }),
		]);
		expect(out.map((r) => r.timestamp)).toEqual([100, 200, 300]);
	});

	it('ordena por timestamp desc', () => {
		const out = sortBy({ field: 'timestamp', dir: 'desc' }, [
			req({ timestamp: 200 }),
			req({ timestamp: 100 }),
			req({ timestamp: 300 }),
		]);
		expect(out.map((r) => r.timestamp)).toEqual([300, 200, 100]);
	});

	it('ordena por transferSize desc, requests sem networkTiming vão pro fim', () => {
		const out = sortBy({ field: 'transferSize', dir: 'desc' }, [
			req({ url: 'https://a/' }), // sem networkTiming
			req({ url: 'https://b/', networkTiming: { transferSize: 1000 } }),
			req({ url: 'https://c/', networkTiming: { transferSize: 5000 } }),
			req({ url: 'https://d/', networkTiming: { transferSize: 200 } }),
		]);
		expect(out.map((r) => r.url)).toEqual([
			'https://c/',
			'https://b/',
			'https://d/',
			'https://a/',
		]);
	});

	it('ordena por ttfbMs desc, requests sem ttfbMs no fim', () => {
		const out = sortBy({ field: 'ttfbMs', dir: 'desc' }, [
			req({ url: 'https://a/', networkTiming: { ttfbMs: 50 } }),
			req({ url: 'https://b/' }),
			req({ url: 'https://c/', networkTiming: { ttfbMs: 500 } }),
		]);
		expect(out.map((r) => r.url)).toEqual(['https://c/', 'https://a/', 'https://b/']);
	});

	it('ordena por duration desc, requests sem duration no fim', () => {
		const out = sortBy({ field: 'duration', dir: 'desc' }, [
			req({ url: 'https://a/', duration: 100 }),
			req({ url: 'https://b/' }),
			req({ url: 'https://c/', duration: 2000 }),
		]);
		expect(out.map((r) => r.url)).toEqual(['https://c/', 'https://a/', 'https://b/']);
	});

	it('asc empurra indefinidos pro fim também', () => {
		const out = sortBy({ field: 'duration', dir: 'asc' }, [
			req({ url: 'https://a/', duration: 100 }),
			req({ url: 'https://b/' }),
			req({ url: 'https://c/', duration: 50 }),
		]);
		expect(out.map((r) => r.url)).toEqual(['https://c/', 'https://a/', 'https://b/']);
	});

	it('ordena por status asc', () => {
		const out = sortBy({ field: 'status', dir: 'asc' }, [
			req({ url: 'https://a/', status: 500 }),
			req({ url: 'https://b/', status: 200 }),
			req({ url: 'https://c/', status: 404 }),
		]);
		expect(out.map((r) => r.status)).toEqual([200, 404, 500]);
	});

	it('ordena por url alfabeticamente desc', () => {
		const out = sortBy({ field: 'url', dir: 'desc' }, [
			req({ url: 'https://b/' }),
			req({ url: 'https://a/' }),
			req({ url: 'https://c/' }),
		]);
		expect(out.map((r) => r.url)).toEqual(['https://c/', 'https://b/', 'https://a/']);
	});
});

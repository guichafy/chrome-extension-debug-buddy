import { renderHook } from '@testing-library/react';
import type { InterceptedResponse } from '@/types/intercepted';
import type { SessionMarker } from '@/types/sessionMarker';
import { useNetworkMetrics } from '../useNetworkMetrics';

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

describe('useNetworkMetrics', () => {
	it('retorna agregados zerados quando marker está vazio', () => {
		const all: Record<string, InterceptedResponse> = {};
		const marker: SessionMarker = {
			sessionStartedAt: null,
			currentPageUrl: null,
			currentPageNavigatedAt: null,
		};
		const { result } = renderHook(() => useNetworkMetrics(all, marker));
		expect(result.current.session.totalRequests).toBe(0);
		expect(result.current.currentPage.totalRequests).toBe(0);
	});

	it('agrega só requests da janela "Sessão" quando sessionStartedAt está setado', () => {
		const all = {
			old: req({ timestamp: 100 }),
			a: req({ timestamp: 1000, networkTiming: { transferSize: 500 } }),
			b: req({ timestamp: 2000, networkTiming: { transferSize: 1500 } }),
		};
		const marker: SessionMarker = {
			sessionStartedAt: 1000,
			currentPageUrl: null,
			currentPageNavigatedAt: null,
		};
		const { result } = renderHook(() => useNetworkMetrics(all, marker));
		expect(result.current.session).toMatchObject({ totalRequests: 2, totalBytes: 2000 });
		expect(result.current.currentPage.totalRequests).toBe(0);
	});

	it('agrega "Página atual" usando currentPageNavigatedAt', () => {
		const all = {
			a: req({ timestamp: 1000 }),
			b: req({ timestamp: 2500, status: 500 }),
			c: req({ timestamp: 3000 }),
		};
		const marker: SessionMarker = {
			sessionStartedAt: 1000,
			currentPageUrl: 'https://x.com',
			currentPageNavigatedAt: 2500,
		};
		const { result } = renderHook(() => useNetworkMetrics(all, marker));
		expect(result.current.currentPage).toMatchObject({ totalRequests: 2, failedCount: 1 });
		expect(result.current.session.totalRequests).toBe(3);
	});

	it('memoiza: mesma referência de input retorna mesmo objeto', () => {
		const all: Record<string, InterceptedResponse> = { a: req({ timestamp: 1500 }) };
		const marker: SessionMarker = {
			sessionStartedAt: 1000,
			currentPageUrl: null,
			currentPageNavigatedAt: null,
		};
		const { result, rerender } = renderHook(
			(props: { all: Record<string, InterceptedResponse>; marker: SessionMarker }) =>
				useNetworkMetrics(props.all, props.marker),
			{ initialProps: { all, marker } },
		);
		const first = result.current;
		rerender({ all, marker });
		expect(result.current).toBe(first);
	});
});

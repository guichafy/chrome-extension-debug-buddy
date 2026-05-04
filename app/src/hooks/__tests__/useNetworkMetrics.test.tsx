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
		expect(result.current.session.totalBytes).toBeNull();
		expect(result.current.session.totalResourceBytes).toBeNull();
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

	it('soma totalResourceBytes a partir dos response bodies capturados', () => {
		const all = {
			a: req({ timestamp: 1500, response: { headers: {}, body: 'hello' } }), // 5
			b: req({ timestamp: 1700, body: 'wo' }), // 2 via alias legado
			c: req({ timestamp: 1900, bodyUnavailableReason: 'binário' }), // não soma
		};
		const marker: SessionMarker = {
			sessionStartedAt: 1000,
			currentPageUrl: null,
			currentPageNavigatedAt: null,
		};
		const { result } = renderHook(() => useNetworkMetrics(all, marker));
		expect(result.current.session.totalResourceBytes).toBe(7);
	});
});

import { getTransferSizeTooltip } from '../transferSize';
import type { InterceptedResponse } from '@/types';

// Helper mínimo: o tipo InterceptedResponse exige muitos campos, mas
// `getTransferSizeTooltip` só lê alguns. Cast evita boilerplate.
function req(partial: Partial<InterceptedResponse>): InterceptedResponse {
	return {
		url: 'https://example.com',
		status: 200,
		statusText: 'OK',
		headers: {},
		type: 'xhr',
		timestamp: 0,
		...partial,
	} as InterceptedResponse;
}

describe('getTransferSizeTooltip', () => {
	it('explica mock quando isMocked=true e transferSize ausente', () => {
		const tooltip = getTransferSizeTooltip(req({ isMocked: true }));
		expect(tooltip).toBe('Mock — não passou pela rede');
	});

	it('explica cache quando fromDiskCache=true', () => {
		const tooltip = getTransferSizeTooltip(
			req({ networkTiming: { transferSize: 0, fromDiskCache: true } }),
		);
		expect(tooltip).toBe('Servido pelo cache do navegador');
	});

	it('explica service worker quando fromServiceWorker=true', () => {
		const tooltip = getTransferSizeTooltip(
			req({ networkTiming: { transferSize: 0, fromServiceWorker: true } }),
		);
		expect(tooltip).toBe('Servido por Service Worker');
	});

	it('explica captureError quando transferSize ausente e há erro de captura', () => {
		const tooltip = getTransferSizeTooltip(req({ captureError: 'CDP timeout para fetch-123' }));
		expect(tooltip).toBe('Falha de captura: CDP timeout para fetch-123');
	});

	it('retorna undefined quando transferSize > 0 (caso normal)', () => {
		const tooltip = getTransferSizeTooltip(req({ networkTiming: { transferSize: 1024 } }));
		expect(tooltip).toBeUndefined();
	});

	it('retorna undefined quando transferSize ausente sem contexto explicativo', () => {
		const tooltip = getTransferSizeTooltip(req({}));
		expect(tooltip).toBeUndefined();
	});

	it('mock tem precedência sobre fromDiskCache (mock substitui rede)', () => {
		// Cenário improvável (mock não deveria ter networkTiming), mas defensivo:
		// se ambos estiverem true, isMocked vence — é o sinal mais claro.
		const tooltip = getTransferSizeTooltip(
			req({
				isMocked: true,
				networkTiming: { transferSize: 0, fromDiskCache: true },
			}),
		);
		expect(tooltip).toBe('Mock — não passou pela rede');
	});

	it('captureError tem precedência sobre cache flags quando transferSize ausente', () => {
		// Se a captura falhou, mostrar o erro é mais útil que dizer "cache".
		const tooltip = getTransferSizeTooltip(
			req({
				captureError: 'sem corpo',
				networkTiming: { fromDiskCache: true },
			}),
		);
		expect(tooltip).toBe('Falha de captura: sem corpo');
	});
});

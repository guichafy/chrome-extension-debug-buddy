import { renderHook, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import type { SessionMarker } from '@/types/sessionMarker';
import { useSessionMarker } from '../useSessionMarker';

describe('useSessionMarker', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('retorna marker zerado inicialmente e busca via getSessionMarker', async () => {
		const marker: SessionMarker = {
			sessionStartedAt: 1000,
			currentPageUrl: 'https://example.com',
			currentPageNavigatedAt: 1500,
		};
		(chrome.runtime.sendMessage as any).mockResolvedValueOnce({ sessionMarker: marker });

		const { result } = renderHook(() => useSessionMarker());

		expect(result.current).toEqual({
			sessionStartedAt: null,
			currentPageUrl: null,
			currentPageNavigatedAt: null,
		});

		await waitFor(() => {
			expect(result.current).toEqual(marker);
		});

		expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({ action: 'getSessionMarker' });
	});

	it('atualiza quando sessionMarkerUpdated chega', async () => {
		const initial: SessionMarker = {
			sessionStartedAt: 1000,
			currentPageUrl: null,
			currentPageNavigatedAt: null,
		};
		(chrome.runtime.sendMessage as any).mockResolvedValueOnce({ sessionMarker: initial });

		let listener: ((msg: any) => void) | undefined;
		(chrome.runtime.onMessage.addListener as any).mockImplementationOnce((fn: any) => {
			listener = fn;
		});

		const { result } = renderHook(() => useSessionMarker());
		await waitFor(() => expect(result.current).toEqual(initial));

		const updated: SessionMarker = {
			sessionStartedAt: 1000,
			currentPageUrl: 'https://test.com',
			currentPageNavigatedAt: 2000,
		};
		listener?.({ action: 'sessionMarkerUpdated', sessionMarker: updated });

		await waitFor(() => expect(result.current).toEqual(updated));
	});

	it('mantém marker zerado quando getSessionMarker falha', async () => {
		(chrome.runtime.sendMessage as any).mockRejectedValueOnce(new Error('boom'));
		const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

		const { result } = renderHook(() => useSessionMarker());
		await waitFor(() => expect(errSpy).toHaveBeenCalled());

		expect(result.current).toEqual({
			sessionStartedAt: null,
			currentPageUrl: null,
			currentPageNavigatedAt: null,
		});

		errSpy.mockRestore();
	});
});

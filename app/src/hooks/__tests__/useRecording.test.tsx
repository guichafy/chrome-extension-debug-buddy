import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useRecording } from '../useRecording';

declare global {
	interface Window {
		chrome: typeof chrome;
	}
}

const sendMessageMock = vi.fn();

beforeEach(() => {
	sendMessageMock.mockReset();
	window.chrome = {
		runtime: {
			sendMessage: sendMessageMock,
		},
	} as unknown as typeof chrome;
});

afterEach(() => {
	vi.useRealTimers();
});

describe('useRecording', () => {
	it('refresh chama getRecordingStatus e atualiza status', async () => {
		sendMessageMock.mockResolvedValueOnce({
			ok: true,
			active: true,
			sessionId: 'sess_1',
			sizeBytes: 1024,
			durationMs: 5000,
		});
		const { result } = renderHook(() => useRecording(7));
		await waitFor(() => {
			expect(result.current.status.active).toBe(true);
		});
		expect(result.current.status.sessionId).toBe('sess_1');
		expect(result.current.status.sizeBytes).toBe(1024);
		expect(sendMessageMock).toHaveBeenCalledWith({ action: 'getRecordingStatus', tabId: 7 });
	});

	it('startRecording dispara action com canvas flag', async () => {
		sendMessageMock
			.mockResolvedValueOnce({ ok: true, active: false })
			.mockResolvedValueOnce({ ok: true, sessionId: 'sess_2' })
			.mockResolvedValueOnce({
				ok: true,
				active: true,
				sessionId: 'sess_2',
				sizeBytes: 0,
				durationMs: 0,
			});
		const { result } = renderHook(() => useRecording(7));
		await waitFor(() => {
			expect(result.current.status.active).toBe(false);
		});
		await act(async () => {
			await result.current.startRecording(true);
		});
		expect(sendMessageMock).toHaveBeenCalledWith({
			action: 'startRecording',
			tabId: 7,
			canvasCaptureEnabled: true,
		});
	});

	it('stopRecording usa sessionId atual', async () => {
		sendMessageMock
			.mockResolvedValueOnce({
				ok: true,
				active: true,
				sessionId: 'sess_3',
				sizeBytes: 100,
				durationMs: 1000,
			})
			.mockResolvedValueOnce({ ok: true })
			.mockResolvedValueOnce({ ok: true, active: false });
		const { result } = renderHook(() => useRecording(7));
		await waitFor(() => {
			expect(result.current.status.sessionId).toBe('sess_3');
		});
		await act(async () => {
			await result.current.stopRecording();
		});
		expect(sendMessageMock).toHaveBeenCalledWith({
			action: 'stopRecording',
			sessionId: 'sess_3',
		});
	});

	it('tabId null pula refresh', async () => {
		const { result } = renderHook(() => useRecording(null));
		expect(result.current.status.active).toBe(false);
		expect(sendMessageMock).not.toHaveBeenCalled();
	});
});

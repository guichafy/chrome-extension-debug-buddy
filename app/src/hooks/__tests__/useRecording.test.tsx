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
			onMessage: {
				addListener: vi.fn(),
				removeListener: vi.fn(),
			},
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

	it('ignora recordingStateChanged de outra tab', async () => {
		const listeners: Array<(msg: unknown) => void> = [];
		window.chrome = {
			runtime: {
				sendMessage: sendMessageMock,
				onMessage: {
					addListener: (cb: unknown) => {
						listeners.push(cb as (msg: unknown) => void);
					},
					removeListener: vi.fn(),
				},
			},
		} as unknown as typeof chrome;

		sendMessageMock.mockResolvedValueOnce({
			ok: true,
			active: false,
			sizeBytes: 0,
			durationMs: 0,
		});

		const { result } = renderHook(() => useRecording(7));
		await waitFor(() => expect(result.current.status.active).toBe(false));

		const callsBefore = sendMessageMock.mock.calls.length;
		listeners.forEach((cb) =>
			cb({ action: 'recordingStateChanged', tabId: 99, active: true, sessionId: 'sess_other' }),
		);
		// Aguarda um tick — refresh nao deve ser chamado para tabId=99 quando o
		// hook esta montado para tabId=7.
		await new Promise((r) => setTimeout(r, 50));
		expect(sendMessageMock.mock.calls.length).toBe(callsBefore);
		expect(result.current.status.active).toBe(false);
	});

	it('refresh ao receber recordingStateChanged via runtime.onMessage', async () => {
		const listeners: Array<(msg: unknown) => void> = [];
		window.chrome = {
			runtime: {
				sendMessage: sendMessageMock,
				onMessage: {
					addListener: (cb: unknown) => {
						listeners.push(cb as (msg: unknown) => void);
					},
					removeListener: vi.fn(),
				},
			},
		} as unknown as typeof chrome;

		sendMessageMock.mockResolvedValueOnce({
			ok: true,
			active: false,
			sizeBytes: 0,
			durationMs: 0,
		});

		const { result } = renderHook(() => useRecording(7));
		await waitFor(() => expect(result.current.status.active).toBe(false));

		// Simula broadcast do background
		sendMessageMock.mockResolvedValueOnce({
			ok: true,
			active: true,
			sessionId: 'sess_x',
			sizeBytes: 100,
			durationMs: 50,
		});
		listeners.forEach((cb) =>
			cb({ action: 'recordingStateChanged', tabId: 7, active: true, sessionId: 'sess_x' }),
		);

		await waitFor(() => expect(result.current.status.active).toBe(true));
	});
});

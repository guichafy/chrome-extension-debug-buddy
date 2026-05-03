import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RecordingBanner } from '../RecordingBanner';

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

describe('RecordingBanner', () => {
	it('não renderiza quando active=false', async () => {
		sendMessageMock.mockResolvedValueOnce({ ok: true, active: false });
		const { container } = render(<RecordingBanner tabId={7} />);
		await waitFor(() => expect(container.firstChild).toBeNull());
	});

	it('renderiza GRAVANDO quando active=true', async () => {
		sendMessageMock.mockResolvedValue({
			ok: true,
			active: true,
			sessionId: 'sess_1',
			sizeBytes: 1024 * 1024 * 5,
			durationMs: 30 * 1000,
		});
		render(<RecordingBanner tabId={7} />);
		await waitFor(() => expect(screen.getByText('GRAVANDO')).toBeInTheDocument());
		expect(screen.getByText(/5\.0 MB \/ 50 MB · 0\.5 \/ 10 min/)).toBeInTheDocument();
		expect(screen.getByText(/clique para parar/i)).toBeInTheDocument();
	});

	it('mostra alerta perto do limite (>=80%)', async () => {
		sendMessageMock.mockResolvedValue({
			ok: true,
			active: true,
			sessionId: 'sess_1',
			sizeBytes: 1024 * 1024 * 45, // 45 MB / 50 = 90%
			durationMs: 60 * 1000,
		});
		render(<RecordingBanner tabId={7} />);
		await waitFor(() => expect(screen.getByText(/próximo do limite/i)).toBeInTheDocument());
	});

	it('clique no banner dispara stopDebugging (lifecycle binding)', async () => {
		// Bug 1: gravação acompanha interceptação. Parar a gravação sozinha
		// enquanto o debugger continua atachado é exatamente o caso ruim
		// invertido. O banner agora delega ao stopDebugging, que dispara o
		// auto-stop coordenado (Runtime/Log.disable + rrweb_stop +
		// recorder.stopSession + detach) no background.
		sendMessageMock.mockImplementation((msg: { action: string }) => {
			if (msg.action === 'getRecordingStatus') {
				return Promise.resolve({
					ok: true,
					active: true,
					sessionId: 'sess_1',
					sizeBytes: 100,
					durationMs: 1000,
				});
			}
			if (msg.action === 'stopDebugging') {
				return Promise.resolve({ ok: true });
			}
			return Promise.resolve({ ok: false });
		});
		render(<RecordingBanner tabId={7} />);
		await waitFor(() => expect(screen.getByText('GRAVANDO')).toBeInTheDocument());
		fireEvent.click(screen.getByRole('button', { name: /Gravando — clique para parar/i }));
		await waitFor(() => {
			const calls = sendMessageMock.mock.calls.map((c) => c[0]);
			expect(calls.some((c: { action: string }) => c.action === 'stopDebugging')).toBe(true);
			// Não deve chamar stopRecording diretamente — bypassaria o lifecycle.
			expect(calls.some((c: { action: string }) => c.action === 'stopRecording')).toBe(false);
		});
	});
});

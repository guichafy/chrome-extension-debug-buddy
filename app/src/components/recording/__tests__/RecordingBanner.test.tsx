import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RecordingBanner } from '../RecordingBanner';

const sendMessageMock = vi.fn();

beforeEach(() => {
	sendMessageMock.mockReset();
	window.chrome = { runtime: { sendMessage: sendMessageMock } } as unknown as typeof chrome;
});

describe('RecordingBanner', () => {
	it('não renderiza quando active=false', async () => {
		sendMessageMock.mockResolvedValueOnce({ ok: true, active: false });
		const { container } = render(<RecordingBanner tabId={7} />);
		await waitFor(() => expect(container.firstChild).toBeNull());
	});

	it('renderiza counter quando active=true', async () => {
		sendMessageMock.mockResolvedValue({
			ok: true,
			active: true,
			sessionId: 'sess_1',
			sizeBytes: 1024 * 1024 * 5,
			durationMs: 30 * 1000,
		});
		render(<RecordingBanner tabId={7} />);
		await waitFor(() => expect(screen.getByText(/Gravando sessão/i)).toBeInTheDocument());
		expect(screen.getByText('00:30 / 10:00')).toBeInTheDocument();
		expect(screen.getByText('5.0 MB / 50 MB')).toBeInTheDocument();
	});

	it('aplica estilo de alerta perto do limite (>80%)', async () => {
		sendMessageMock.mockResolvedValue({
			ok: true,
			active: true,
			sessionId: 'sess_1',
			sizeBytes: 1024 * 1024 * 45,
			durationMs: 60 * 1000,
		});
		render(<RecordingBanner tabId={7} />);
		await waitFor(() => expect(screen.getByText(/perto do limite/i)).toBeInTheDocument());
	});
});

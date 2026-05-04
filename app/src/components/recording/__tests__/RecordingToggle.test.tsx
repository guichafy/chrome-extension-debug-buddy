import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { RecordingToggle } from '../RecordingToggle';

vi.mock('@/lib/session/recordingPreference', () => ({
	getRecordingDisabled: vi.fn(async () => false),
	setRecordingDisabled: vi.fn(async () => undefined),
}));

const useRecordingMock = vi.fn();

vi.mock('@/hooks/useRecording', () => ({
	useRecording: (tabId: number | null) => useRecordingMock(tabId),
}));

vi.mock('@/hooks/useSessions', () => ({
	useSessions: () => ({ sessions: [] }),
}));

const inactiveStatus = {
	status: { active: false, sizeBytes: 0, durationMs: 0 },
	startRecording: vi.fn(),
	stopRecording: vi.fn(),
	refresh: vi.fn(),
};

beforeEach(() => {
	useRecordingMock.mockReset();
	useRecordingMock.mockReturnValue(inactiveStatus);
});

describe('RecordingToggle', () => {
	test('switch reflete recordingDisabled invertido (UI mostra Gravação ON)', async () => {
		const mod = await import('@/lib/session/recordingPreference');
		(
			mod.getRecordingDisabled as unknown as { mockResolvedValueOnce: (v: boolean) => void }
		).mockResolvedValueOnce(false);
		render(<RecordingToggle tabId={1} interceptionActive={true} />);
		await waitFor(() => {
			const sw = screen.getByLabelText('Gravação') as HTMLInputElement;
			// Storage false (não desabilitado) = UI mostra ligado.
			expect(sw.getAttribute('aria-checked')).toBe('true');
		});
	});

	test('clicar switch desliga -> setRecordingDisabled(true)', async () => {
		const mod = await import('@/lib/session/recordingPreference');
		render(<RecordingToggle tabId={1} interceptionActive={true} />);
		const sw = await screen.findByLabelText('Gravação');
		fireEvent.click(sw);
		await waitFor(() => {
			expect(mod.setRecordingDisabled).toHaveBeenCalledWith(true);
		});
	});

	test('toggle off durante interception envia setRecordingLive', async () => {
		const sendMessageMock = chrome.runtime.sendMessage as unknown as ReturnType<typeof vi.fn>;
		sendMessageMock.mockClear();
		sendMessageMock.mockResolvedValueOnce({ ok: true });
		const mod = await import('@/lib/session/recordingPreference');
		(
			mod.getRecordingDisabled as unknown as { mockResolvedValueOnce: (v: boolean) => void }
		).mockResolvedValueOnce(false);

		render(<RecordingToggle tabId={5} interceptionActive={true} />);
		const sw = await screen.findByLabelText('Gravação');
		fireEvent.click(sw);

		await waitFor(() => {
			expect(sendMessageMock).toHaveBeenCalledWith({
				action: 'setRecordingLive',
				tabId: 5,
				active: false,
			});
		});
	});

	test('exibe metricas quando status.active && interceptionActive', async () => {
		useRecordingMock.mockReturnValue({
			status: {
				active: true,
				sessionId: 'sess_x',
				sizeBytes: 25 * 1024 * 1024, // 25 MB
				durationMs: 5 * 60 * 1000, // 5 min
			},
			startRecording: vi.fn(),
			stopRecording: vi.fn(),
			refresh: vi.fn(),
		});
		const mod = await import('@/lib/session/recordingPreference');
		(
			mod.getRecordingDisabled as unknown as { mockResolvedValueOnce: (v: boolean) => void }
		).mockResolvedValueOnce(false);

		render(<RecordingToggle tabId={1} interceptionActive={true} />);

		expect(await screen.findByText(/25\.0 MB/)).toBeInTheDocument();
		expect(screen.getByText(/5\.0m/)).toBeInTheDocument();
		// Não está acima de 80% — sem warning.
		expect(screen.queryByText(/próximo do limite/i)).not.toBeInTheDocument();
	});

	test('exibe warning "próximo do limite" quando size >= 80%', async () => {
		useRecordingMock.mockReturnValue({
			status: {
				active: true,
				sessionId: 'sess_x',
				sizeBytes: 45 * 1024 * 1024, // 45 MB / 50 = 90%
				durationMs: 1 * 60 * 1000,
			},
			startRecording: vi.fn(),
			stopRecording: vi.fn(),
			refresh: vi.fn(),
		});
		const mod = await import('@/lib/session/recordingPreference');
		(
			mod.getRecordingDisabled as unknown as { mockResolvedValueOnce: (v: boolean) => void }
		).mockResolvedValueOnce(false);

		render(<RecordingToggle tabId={1} interceptionActive={true} />);

		expect(await screen.findByText(/próximo do limite/i)).toBeInTheDocument();
	});

	test('NAO exibe metricas quando status.active === false', async () => {
		// Default mock retorna inactiveStatus (active: false).
		const mod = await import('@/lib/session/recordingPreference');
		(
			mod.getRecordingDisabled as unknown as { mockResolvedValueOnce: (v: boolean) => void }
		).mockResolvedValueOnce(false);

		render(<RecordingToggle tabId={1} interceptionActive={false} />);

		expect(screen.queryByText(/MB/)).not.toBeInTheDocument();
		expect(screen.queryByText(/próximo do limite/i)).not.toBeInTheDocument();
	});

	// Regressão Bug 1: switch deve ficar EDITÁVEL mesmo quando interceptação está
	// OFF, para o usuário pré-configurar "gravação OFF por default" antes do
	// Iniciar Interceptação.
	test('switch fica editavel quando interceptionActive=false (pre-config)', async () => {
		const mod = await import('@/lib/session/recordingPreference');
		(
			mod.getRecordingDisabled as unknown as { mockResolvedValueOnce: (v: boolean) => void }
		).mockResolvedValueOnce(false);
		render(<RecordingToggle tabId={null} interceptionActive={false} />);
		const sw = await screen.findByLabelText('Gravação');
		expect(sw).not.toBeDisabled();
		fireEvent.click(sw);
		await waitFor(() => {
			expect(mod.setRecordingDisabled).toHaveBeenCalledWith(true);
		});
	});

	test('toggle sem interceptacao NAO envia setRecordingLive', async () => {
		const sendMessageMock = chrome.runtime.sendMessage as unknown as ReturnType<typeof vi.fn>;
		sendMessageMock.mockClear();
		const mod = await import('@/lib/session/recordingPreference');
		(
			mod.getRecordingDisabled as unknown as { mockResolvedValueOnce: (v: boolean) => void }
		).mockResolvedValueOnce(false);
		render(<RecordingToggle tabId={null} interceptionActive={false} />);
		const sw = await screen.findByLabelText('Gravação');
		fireEvent.click(sw);
		await waitFor(() => {
			expect(mod.setRecordingDisabled).toHaveBeenCalledWith(true);
		});
		expect(sendMessageMock).not.toHaveBeenCalledWith(
			expect.objectContaining({ action: 'setRecordingLive' }),
		);
	});
});

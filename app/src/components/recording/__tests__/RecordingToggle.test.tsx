import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { RecordingToggle } from '../RecordingToggle';

vi.mock('@/lib/session/recordingPreference', () => ({
	getRecordingDisabled: vi.fn(async () => false),
	setRecordingDisabled: vi.fn(async () => undefined),
}));

vi.mock('@/hooks/useRecording', () => ({
	useRecording: () => ({
		status: { active: false, sizeBytes: 0, durationMs: 0 },
		startRecording: vi.fn(),
		stopRecording: vi.fn(),
	}),
}));

vi.mock('@/hooks/useSessions', () => ({
	useSessions: () => ({ sessions: [] }),
}));

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
});

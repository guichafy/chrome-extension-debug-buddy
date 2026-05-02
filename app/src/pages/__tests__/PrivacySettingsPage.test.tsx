import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_REDACTION_CONFIG } from '@/lib/session/privacy/defaults';
import { PrivacySettingsPage } from '../PrivacySettingsPage';

const sendMessageMock = vi.fn();

beforeEach(() => {
	sendMessageMock.mockReset();
	window.chrome = { runtime: { sendMessage: sendMessageMock } } as unknown as typeof chrome;
});

describe('PrivacySettingsPage', () => {
	it('carrega config e exibe seções', async () => {
		sendMessageMock.mockResolvedValue({ ok: true, privacyConfig: DEFAULT_REDACTION_CONFIG });
		render(<PrivacySettingsPage />);
		await waitFor(() => expect(screen.getByText(/Privacidade & Redação/)).toBeInTheDocument());
		expect(screen.getByLabelText(/Redação habilitada/i)).toBeInTheDocument();
		expect(screen.getByText(/Network — Headers/i)).toBeInTheDocument();
		expect(screen.getByText(/rrweb \(DOM\/inputs\)/i)).toBeInTheDocument();
	});

	it('salva edição via setPrivacyConfig', async () => {
		sendMessageMock.mockImplementation((msg: { action: string; config?: unknown }) => {
			if (msg.action === 'getPrivacyConfig') {
				return Promise.resolve({ ok: true, privacyConfig: DEFAULT_REDACTION_CONFIG });
			}
			if (msg.action === 'setPrivacyConfig') {
				return Promise.resolve({ ok: true });
			}
			return Promise.resolve({ ok: false });
		});
		render(<PrivacySettingsPage />);
		await waitFor(() => expect(screen.getByText(/Privacidade & Redação/)).toBeInTheDocument());
		const input = screen.getByLabelText(/Seletor CSS para mascarar texto/i) as HTMLInputElement;
		fireEvent.change(input, { target: { value: '.new-mask' } });
		fireEvent.click(screen.getByRole('button', { name: /^Salvar/i }));
		await waitFor(() => expect(screen.getByText(/Configuração salva/i)).toBeInTheDocument());
		const calls = sendMessageMock.mock.calls.map((c) => c[0]);
		const setCall = calls.find((c: { action: string }) => c.action === 'setPrivacyConfig') as
			| { config: { rrwebMaskTextSelector: string } }
			| undefined;
		expect(setCall?.config.rrwebMaskTextSelector).toBe('.new-mask');
	});

	it('chama purgeOldSessions e mostra contagem', async () => {
		sendMessageMock.mockImplementation((msg: { action: string }) => {
			if (msg.action === 'getPrivacyConfig') {
				return Promise.resolve({ ok: true, privacyConfig: DEFAULT_REDACTION_CONFIG });
			}
			if (msg.action === 'purgeOldSessions') {
				return Promise.resolve({ ok: true, purgedCount: 3 });
			}
			return Promise.resolve({ ok: false });
		});
		render(<PrivacySettingsPage />);
		await waitFor(() => expect(screen.getByText(/Privacidade & Redação/)).toBeInTheDocument());
		fireEvent.click(screen.getByRole('button', { name: /Purgar agora/i }));
		await waitFor(() => expect(screen.getByText(/Removidas 3 sessões/i)).toBeInTheDocument());
	});
});

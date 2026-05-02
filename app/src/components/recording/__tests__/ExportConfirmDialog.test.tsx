import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_REDACTION_CONFIG } from '@/lib/session/privacy/defaults';
import { ExportConfirmDialog } from '../ExportConfirmDialog';

const sendMessageMock = vi.fn();

beforeEach(() => {
	sendMessageMock.mockReset();
	window.chrome = {
		runtime: { sendMessage: sendMessageMock },
	} as unknown as typeof chrome;
});

describe('ExportConfirmDialog', () => {
	it('renderiza aviso de privacidade quando aberto e nao menciona "versao futura"', async () => {
		sendMessageMock.mockResolvedValue({ ok: true, privacyConfig: DEFAULT_REDACTION_CONFIG });
		render(<ExportConfirmDialog open={true} onOpenChange={() => {}} onConfirm={() => {}} />);
		expect(screen.getByText(/Authorization headers e cookies/i)).toBeInTheDocument();
		expect(screen.getByText(/senha, token ou número de cartão/i)).toBeInTheDocument();
		// Garante que o texto antigo de "versão futura" foi removido
		expect(screen.queryByText(/versão futura/i)).not.toBeInTheDocument();
	});

	it('mostra sumário de redaction aplicado a partir de getPrivacyConfig', async () => {
		sendMessageMock.mockResolvedValue({ ok: true, privacyConfig: DEFAULT_REDACTION_CONFIG });
		render(<ExportConfirmDialog open={true} onOpenChange={() => {}} onConfirm={() => {}} />);
		await waitFor(() =>
			expect(screen.getByText(/Mascaramento que será aplicado/i)).toBeInTheDocument(),
		);
		// Headers: 6 chaves + 2 regex
		const headersItem = await screen.findByText(/Headers redigidos:/i);
		expect(headersItem.textContent).toMatch(/6 chaves \+ 2 regex/);
		// Body regex: 4
		expect(screen.getByText(/Body — regex aplicadas:/i).textContent).toMatch(/4/);
		// Referencia "Configurações > Privacidade"
		expect(screen.getByText(/Configurações > Privacidade/i)).toBeInTheDocument();
		// Confirma que getPrivacyConfig foi chamado
		expect(sendMessageMock).toHaveBeenCalledWith({ action: 'getPrivacyConfig' });
	});

	it('botão "Entendi, exportar" chama onConfirm e fecha', async () => {
		sendMessageMock.mockResolvedValue({ ok: true, privacyConfig: DEFAULT_REDACTION_CONFIG });
		const user = userEvent.setup();
		const onConfirm = vi.fn();
		const onOpenChange = vi.fn();
		render(<ExportConfirmDialog open={true} onOpenChange={onOpenChange} onConfirm={onConfirm} />);
		await user.click(screen.getByRole('button', { name: /Entendi/i }));
		expect(onConfirm).toHaveBeenCalledOnce();
		expect(onOpenChange).toHaveBeenCalledWith(false);
	});

	it('botão Cancelar fecha sem chamar onConfirm', async () => {
		sendMessageMock.mockResolvedValue({ ok: true, privacyConfig: DEFAULT_REDACTION_CONFIG });
		const user = userEvent.setup();
		const onConfirm = vi.fn();
		const onOpenChange = vi.fn();
		render(<ExportConfirmDialog open={true} onOpenChange={onOpenChange} onConfirm={onConfirm} />);
		await user.click(screen.getByRole('button', { name: /Cancelar/i }));
		expect(onConfirm).not.toHaveBeenCalled();
		expect(onOpenChange).toHaveBeenCalledWith(false);
	});

	it('mostra alerta quando enabled=false', async () => {
		sendMessageMock.mockResolvedValue({
			ok: true,
			privacyConfig: { ...DEFAULT_REDACTION_CONFIG, enabled: false },
		});
		render(<ExportConfirmDialog open={true} onOpenChange={() => {}} onConfirm={() => {}} />);
		await waitFor(() => expect(screen.getByText(/mascaramento está/i)).toBeInTheDocument());
		expect(screen.getByText(/Nada será redigido/i)).toBeInTheDocument();
	});
});

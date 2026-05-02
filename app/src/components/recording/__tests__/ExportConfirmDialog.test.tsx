import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ExportConfirmDialog } from '../ExportConfirmDialog';

describe('ExportConfirmDialog', () => {
	it('renderiza aviso de privacidade quando aberto', () => {
		render(<ExportConfirmDialog open={true} onOpenChange={() => {}} onConfirm={() => {}} />);
		expect(screen.getByText(/Authorization headers e cookies/i)).toBeInTheDocument();
		expect(screen.getByText(/senha, token ou número de cartão/i)).toBeInTheDocument();
	});

	it('botão "Entendi, exportar" chama onConfirm e fecha', async () => {
		const user = userEvent.setup();
		const onConfirm = vi.fn();
		const onOpenChange = vi.fn();
		render(<ExportConfirmDialog open={true} onOpenChange={onOpenChange} onConfirm={onConfirm} />);
		await user.click(screen.getByRole('button', { name: /Entendi/i }));
		expect(onConfirm).toHaveBeenCalledOnce();
		expect(onOpenChange).toHaveBeenCalledWith(false);
	});

	it('botão Cancelar fecha sem chamar onConfirm', async () => {
		const user = userEvent.setup();
		const onConfirm = vi.fn();
		const onOpenChange = vi.fn();
		render(<ExportConfirmDialog open={true} onOpenChange={onOpenChange} onConfirm={onConfirm} />);
		await user.click(screen.getByRole('button', { name: /Cancelar/i }));
		expect(onConfirm).not.toHaveBeenCalled();
		expect(onOpenChange).toHaveBeenCalledWith(false);
	});
});

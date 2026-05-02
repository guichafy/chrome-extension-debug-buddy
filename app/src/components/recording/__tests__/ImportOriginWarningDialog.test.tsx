import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ImportOriginWarningDialog } from '../ImportOriginWarningDialog';

describe('ImportOriginWarningDialog', () => {
	it('mostra origem importada e origem atual', () => {
		render(
			<ImportOriginWarningDialog
				open={true}
				importedOrigin="https://app.exemplo.com"
				currentOrigin="https://outro.com"
				onContinue={() => {}}
				onCancel={() => {}}
			/>,
		);
		expect(screen.getByText(/app\.exemplo\.com/)).toBeInTheDocument();
		expect(screen.getByText(/outro\.com/)).toBeInTheDocument();
	});

	it('botão Continuar dispara onContinue', async () => {
		const user = userEvent.setup();
		const onContinue = vi.fn();
		const onCancel = vi.fn();
		render(
			<ImportOriginWarningDialog
				open={true}
				importedOrigin="https://a.com"
				currentOrigin="https://b.com"
				onContinue={onContinue}
				onCancel={onCancel}
			/>,
		);
		await user.click(screen.getByRole('button', { name: /Continuar/i }));
		expect(onContinue).toHaveBeenCalledOnce();
		expect(onCancel).not.toHaveBeenCalled();
	});

	it('botão Cancelar dispara onCancel', async () => {
		const user = userEvent.setup();
		const onContinue = vi.fn();
		const onCancel = vi.fn();
		render(
			<ImportOriginWarningDialog
				open={true}
				importedOrigin="https://a.com"
				currentOrigin="https://b.com"
				onContinue={onContinue}
				onCancel={onCancel}
			/>,
		);
		await user.click(screen.getByRole('button', { name: /Cancelar/i }));
		expect(onCancel).toHaveBeenCalledOnce();
		expect(onContinue).not.toHaveBeenCalled();
	});
});

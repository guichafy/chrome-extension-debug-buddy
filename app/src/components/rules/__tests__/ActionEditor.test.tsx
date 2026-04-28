import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ActionEditor } from '../ActionEditor';
import type { MockAction } from '@/types/rules';

describe('ActionEditor', () => {
	const selectTab = async (name: string) => {
		const tab = screen.getByRole('tab', { name });
		fireEvent.mouseDown(tab, { button: 0, ctrlKey: false });
		await waitFor(() => expect(tab).toHaveAttribute('data-state', 'active'));
	};

	it('mantem mock sem body quando body nao foi configurado', async () => {
		const onChange = vi.fn();
		const action: MockAction = {
			type: 'mock',
			enabled: true,
			status: 204,
			headers: {},
		};

		render(<ActionEditor action={action} onChange={onChange} />);
		await selectTab('Body');

		expect(screen.getByLabelText('Enviar body na resposta mockada')).not.toBeChecked();
		expect(
			screen.getByPlaceholderText('{"success": true, "message": "Resposta mockada"}'),
		).toBeDisabled();
		expect(screen.getByText('O mock será enviado sem corpo de resposta.')).toBeInTheDocument();
	});

	it('adiciona body vazio quando o usuario habilita body', async () => {
		const onChange = vi.fn();
		const action: MockAction = {
			type: 'mock',
			enabled: true,
			status: 200,
			headers: {},
		};

		render(<ActionEditor action={action} onChange={onChange} />);
		await selectTab('Body');
		fireEvent.click(screen.getByLabelText('Enviar body na resposta mockada'));

		expect(onChange).toHaveBeenCalledWith({
			...action,
			body: '',
		});
	});

	it('atualiza latencia fixa em ms', async () => {
		const onChange = vi.fn();
		const action: MockAction = {
			type: 'mock',
			enabled: true,
			status: 200,
			headers: {},
			latency: { mode: 'fixed', delayMs: 100 },
		};

		render(<ActionEditor action={action} onChange={onChange} />);
		await selectTab('Latência');
		fireEvent.change(screen.getByDisplayValue('100'), { target: { value: '250' } });

		expect(onChange).toHaveBeenCalledWith({
			...action,
			latency: { mode: 'fixed', delayMs: 250 },
		});
	});
});

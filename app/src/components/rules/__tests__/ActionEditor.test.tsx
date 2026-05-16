import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ActionEditor } from '../ActionEditor';
import type { BreakpointAction, MockAction } from '@/types/rules';

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

	// Teste de "atualiza latência fixa" removido: MockAction não tem mais campo
	// `latency` no schema v2. A latência agora vive em `actions: [requestDelay,
	// mock]` composto na regra; cobertura migrou para presets/templates.

	describe('ação Breakpoint', () => {
		it('renderiza apenas descrição opcional + texto explicativo (sem outros campos)', () => {
			const action: BreakpointAction = { type: 'breakpoint', enabled: true };
			render(<ActionEditor action={action} onChange={vi.fn()} />);

			expect(screen.getByTestId('breakpoint-action-editor')).toBeInTheDocument();
			expect(screen.getByTestId('breakpoint-action-description')).toBeInTheDocument();

			expect(
				screen.getByText(/Quando esta regra casar, o request será pausado/),
			).toBeInTheDocument();
			expect(
				screen.getByText(/dialog de inspeção será aberto para edição manual/),
			).toBeInTheDocument();

			// Sem o Select legado de "Tipo de Ação" — o wizard step Tipo já trata isso.
			expect(screen.queryByText('Tipo de Ação')).toBeNull();
			expect(screen.queryByRole('combobox')).toBeNull();
		});

		it('atualiza description ao digitar no Textarea', () => {
			const onChange = vi.fn();
			const action: BreakpointAction = { type: 'breakpoint', enabled: true };
			render(<ActionEditor action={action} onChange={onChange} />);

			fireEvent.change(screen.getByTestId('breakpoint-action-description'), {
				target: { value: 'Pausar para conferir token' },
			});

			expect(onChange).toHaveBeenCalledWith({
				type: 'breakpoint',
				enabled: true,
				description: 'Pausar para conferir token',
			});
		});

		it('exibe descrição já configurada no Textarea', () => {
			const action: BreakpointAction = {
				type: 'breakpoint',
				enabled: true,
				description: 'Inspecionar payload',
			};
			render(<ActionEditor action={action} onChange={vi.fn()} />);

			expect(screen.getByTestId('breakpoint-action-description')).toHaveValue(
				'Inspecionar payload',
			);
		});
	});
});

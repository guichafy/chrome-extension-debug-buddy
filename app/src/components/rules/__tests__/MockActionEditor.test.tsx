import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MockActionEditor } from '../MockActionEditor';
import type { MockAction } from '@/types/rules';

const baseAction = (overrides: Partial<MockAction> = {}): MockAction => ({
	type: 'mock',
	enabled: true,
	status: 200,
	headers: {},
	...overrides,
});

const selectTab = async (name: string) => {
	const tab = screen.getByRole('tab', { name });
	fireEvent.mouseDown(tab, { button: 0, ctrlKey: false });
	await waitFor(() => expect(tab).toHaveAttribute('data-state', 'active'));
};

describe('MockActionEditor — status code', () => {
	it('renderiza valor inicial e os 7 presets exigidos', () => {
		render(<MockActionEditor action={baseAction({ status: 200 })} onChange={vi.fn()} />);
		expect(screen.getByTestId('mock-action-status-input')).toHaveValue(200);
		const expected = [200, 204, 400, 401, 403, 404, 500];
		for (const code of expected) {
			expect(screen.getByTestId(`mock-action-status-preset-${code}`)).toBeInTheDocument();
		}
	});

	it('clicar em preset 500 emite onChange com status 500', () => {
		const onChange = vi.fn();
		render(<MockActionEditor action={baseAction({ status: 200 })} onChange={onChange} />);
		fireEvent.click(screen.getByTestId('mock-action-status-preset-500'));
		expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ status: 500 }));
	});

	it('preset selecionado é destacado via aria-pressed/data-selected', () => {
		render(<MockActionEditor action={baseAction({ status: 404 })} onChange={vi.fn()} />);
		const preset = screen.getByTestId('mock-action-status-preset-404');
		expect(preset).toHaveAttribute('aria-pressed', 'true');
		expect(preset).toHaveAttribute('data-selected', 'true');
		const other = screen.getByTestId('mock-action-status-preset-200');
		expect(other).toHaveAttribute('aria-pressed', 'false');
	});

	it('rejeita status fora de 100-599 com erro inline e não chama onChange', () => {
		const onChange = vi.fn();
		render(<MockActionEditor action={baseAction({ status: 200 })} onChange={onChange} />);
		fireEvent.change(screen.getByTestId('mock-action-status-input'), {
			target: { value: '99' },
		});
		expect(onChange).not.toHaveBeenCalled();
		expect(screen.getByTestId('mock-action-status-error')).toBeInTheDocument();
	});

	it('rejeita status não numérico com erro inline', () => {
		const onChange = vi.fn();
		render(<MockActionEditor action={baseAction({ status: 200 })} onChange={onChange} />);
		fireEvent.change(screen.getByTestId('mock-action-status-input'), {
			target: { value: 'abc' },
		});
		expect(onChange).not.toHaveBeenCalled();
		expect(screen.getByTestId('mock-action-status-error')).toBeInTheDocument();
	});
});

describe('MockActionEditor — headers', () => {
	it('adiciona um header ao clicar em "Adicionar"', async () => {
		const onChange = vi.fn();
		render(<MockActionEditor action={baseAction()} onChange={onChange} />);
		await selectTab('Headers');
		fireEvent.change(screen.getByTestId('mock-action-header-name'), {
			target: { value: 'X-Custom' },
		});
		fireEvent.change(screen.getByTestId('mock-action-header-value'), {
			target: { value: 'on' },
		});
		fireEvent.click(screen.getByTestId('mock-action-header-add'));
		expect(onChange).toHaveBeenCalledWith(
			expect.objectContaining({
				headers: { 'X-Custom': 'on' },
			}),
		);
	});

	it('lista headers configurados e permite remover', async () => {
		const onChange = vi.fn();
		render(
			<MockActionEditor
				action={baseAction({ headers: { 'Content-Type': 'application/json' } })}
				onChange={onChange}
			/>,
		);
		await selectTab('Headers');
		expect(screen.getByTestId('mock-action-header-row-Content-Type')).toBeInTheDocument();
		fireEvent.click(screen.getByTestId('mock-action-header-remove-Content-Type'));
		expect(onChange).toHaveBeenCalledWith(
			expect.objectContaining({
				headers: {},
			}),
		);
	});

	it('botão "Adicionar" fica desabilitado quando algum campo está vazio', async () => {
		render(<MockActionEditor action={baseAction()} onChange={vi.fn()} />);
		await selectTab('Headers');
		expect(screen.getByTestId('mock-action-header-add')).toBeDisabled();
		fireEvent.change(screen.getByTestId('mock-action-header-name'), {
			target: { value: 'X-Custom' },
		});
		expect(screen.getByTestId('mock-action-header-add')).toBeDisabled();
		fireEvent.change(screen.getByTestId('mock-action-header-value'), {
			target: { value: 'on' },
		});
		expect(screen.getByTestId('mock-action-header-add')).not.toBeDisabled();
	});
});

describe('MockActionEditor — body com JSON', () => {
	it('habilitar body cria body vazio', async () => {
		const onChange = vi.fn();
		render(<MockActionEditor action={baseAction()} onChange={onChange} />);
		await selectTab('Body');
		fireEvent.click(screen.getByTestId('mock-action-body-enabled'));
		expect(onChange).toHaveBeenCalledWith(
			expect.objectContaining({
				body: '',
			}),
		);
	});

	it('mostra "JSON válido" para JSON válido', async () => {
		render(<MockActionEditor action={baseAction({ body: '{"ok":true}' })} onChange={vi.fn()} />);
		await selectTab('Body');
		expect(screen.getByTestId('mock-action-body-validation-valid')).toBeInTheDocument();
	});

	it('mostra erro inline quando JSON é inválido', async () => {
		render(<MockActionEditor action={baseAction({ body: '{ invalid json' })} onChange={vi.fn()} />);
		await selectTab('Body');
		expect(screen.getByTestId('mock-action-body-validation-error')).toBeInTheDocument();
	});

	it('botão "Formatar JSON" fica desabilitado quando body vazio', async () => {
		render(<MockActionEditor action={baseAction({ body: '' })} onChange={vi.fn()} />);
		await selectTab('Body');
		expect(screen.getByTestId('mock-action-body-format')).toBeDisabled();
	});

	it('botão "Formatar JSON" fica desabilitado quando body é JSON inválido', async () => {
		render(<MockActionEditor action={baseAction({ body: '{not json' })} onChange={vi.fn()} />);
		await selectTab('Body');
		expect(screen.getByTestId('mock-action-body-format')).toBeDisabled();
	});

	it('clicar em "Formatar JSON" reformata body válido com indentação de 2 espaços', async () => {
		const onChange = vi.fn();
		render(
			<MockActionEditor action={baseAction({ body: '{"a":1,"b":[2,3]}' })} onChange={onChange} />,
		);
		await selectTab('Body');
		fireEvent.click(screen.getByTestId('mock-action-body-format'));
		expect(onChange).toHaveBeenCalledWith(
			expect.objectContaining({
				body: '{\n  "a": 1,\n  "b": [\n    2,\n    3\n  ]\n}',
			}),
		);
	});

	it('digitar JSON inválido não silencia o erro (sem fallback)', async () => {
		const onChange = vi.fn();
		const { rerender } = render(
			<MockActionEditor action={baseAction({ body: '' })} onChange={onChange} />,
		);
		await selectTab('Body');
		fireEvent.change(screen.getByTestId('mock-action-body-textarea'), {
			target: { value: '{ broken' },
		});
		// O onChange propaga o conteúdo (sem fallback de "salvar valido"), mas
		// o validator mostra erro visivel ao usuario.
		expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ body: '{ broken' }));
		// Re-render simulando estado pai atualizado
		rerender(<MockActionEditor action={baseAction({ body: '{ broken' })} onChange={onChange} />);
		expect(screen.getByTestId('mock-action-body-validation-error')).toBeInTheDocument();
	});
});

describe('MockActionEditor — latência', () => {
	it('atualiza latência fixa em ms', async () => {
		const onChange = vi.fn();
		render(
			<MockActionEditor
				action={baseAction({ latency: { mode: 'fixed', delayMs: 100 } })}
				onChange={onChange}
			/>,
		);
		await selectTab('Latência');
		fireEvent.change(screen.getByTestId('mock-action-latency-delay'), {
			target: { value: '250' },
		});
		expect(onChange).toHaveBeenCalledWith(
			expect.objectContaining({
				latency: { mode: 'fixed', delayMs: 250 },
			}),
		);
	});
});

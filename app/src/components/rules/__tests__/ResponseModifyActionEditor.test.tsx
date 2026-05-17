import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import type { ResponseModifyAction } from '@/types/rules';
import { ResponseModifyActionEditor } from '../ResponseModifyActionEditor';

const baseAction = (overrides: Partial<ResponseModifyAction> = {}): ResponseModifyAction => ({
	type: 'responseModify',
	enabled: true,
	...overrides,
});

const selectTab = async (name: string) => {
	const tab = screen.getByRole('tab', { name });
	fireEvent.mouseDown(tab, { button: 0, ctrlKey: false });
	await waitFor(() => expect(tab).toHaveAttribute('data-state', 'active'));
};

describe('ResponseModifyActionEditor — Status override', () => {
	test('por default status fica desabilitado e input vazio', () => {
		render(<ResponseModifyActionEditor action={baseAction()} onChange={vi.fn()} />);
		expect(screen.getByTestId('response-modify-status-enabled')).not.toBeChecked();
		expect(screen.getByTestId('response-modify-status-input')).toBeDisabled();
	});

	test('habilitar status seta 200 default', () => {
		const onChange = vi.fn();
		render(<ResponseModifyActionEditor action={baseAction()} onChange={onChange} />);
		fireEvent.click(screen.getByTestId('response-modify-status-enabled'));
		expect(onChange).toHaveBeenCalledWith({
			type: 'responseModify',
			enabled: true,
			status: 200,
		});
	});

	test('digitar status fora de 100-599 mostra erro e NÃO chama onChange', () => {
		const onChange = vi.fn();
		render(<ResponseModifyActionEditor action={baseAction({ status: 200 })} onChange={onChange} />);
		fireEvent.change(screen.getByTestId('response-modify-status-input'), {
			target: { value: '99' },
		});
		expect(onChange).not.toHaveBeenCalled();
		expect(screen.getByTestId('response-modify-status-error')).toBeInTheDocument();
	});

	test('digitar status válido atualiza payload', () => {
		const onChange = vi.fn();
		render(<ResponseModifyActionEditor action={baseAction({ status: 200 })} onChange={onChange} />);
		fireEvent.change(screen.getByTestId('response-modify-status-input'), {
			target: { value: '404' },
		});
		expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ status: 404 }));
	});
});

describe('ResponseModifyActionEditor — Body tab', () => {
	test('habilitar body cria string vazia', async () => {
		const onChange = vi.fn();
		render(<ResponseModifyActionEditor action={baseAction()} onChange={onChange} />);
		await selectTab('Body');
		fireEvent.click(screen.getByTestId('response-modify-body-enabled'));
		expect(onChange).toHaveBeenCalledWith({
			type: 'responseModify',
			enabled: true,
			body: '',
		});
	});

	test('digitar no textarea atualiza body', async () => {
		const onChange = vi.fn();
		render(<ResponseModifyActionEditor action={baseAction({ body: '' })} onChange={onChange} />);
		await selectTab('Body');
		fireEvent.change(screen.getByTestId('response-modify-body-textarea'), {
			target: { value: '{"injected": true}' },
		});
		expect(onChange).toHaveBeenCalledWith({
			type: 'responseModify',
			enabled: true,
			body: '{"injected": true}',
		});
	});
});

describe('ResponseModifyActionEditor — Headers tab', () => {
	test('adicionar header em "add" propaga addHeaders', async () => {
		const onChange = vi.fn();
		render(<ResponseModifyActionEditor action={baseAction()} onChange={onChange} />);
		await selectTab('Headers');
		fireEvent.change(screen.getByTestId('response-modify-headers-add-name'), {
			target: { value: 'X-Cache' },
		});
		fireEvent.change(screen.getByTestId('response-modify-headers-add-value'), {
			target: { value: 'MISS' },
		});
		fireEvent.click(screen.getByTestId('response-modify-headers-add-add'));
		expect(onChange).toHaveBeenCalledWith(
			expect.objectContaining({
				addHeaders: { 'X-Cache': 'MISS' },
			}),
		);
	});
});

describe('ResponseModifyActionEditor — banner', () => {
	test('renderiza banner explicativo apontando estágio Response', () => {
		render(<ResponseModifyActionEditor action={baseAction()} onChange={vi.fn()} />);
		expect(screen.getByTestId('response-modify-action-info')).toHaveTextContent(
			/estágio.*Response/,
		);
	});
});

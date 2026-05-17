import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import type { RequestModifyAction } from '@/types/rules';
import { RequestModifyActionEditor } from '../RequestModifyActionEditor';

const baseAction = (overrides: Partial<RequestModifyAction> = {}): RequestModifyAction => ({
	type: 'requestModify',
	enabled: true,
	...overrides,
});

const selectTab = async (name: string) => {
	const tab = screen.getByRole('tab', { name });
	fireEvent.mouseDown(tab, { button: 0, ctrlKey: false });
	await waitFor(() => expect(tab).toHaveAttribute('data-state', 'active'));
};

describe('RequestModifyActionEditor — URL override', () => {
	test('por default url está desabilitado e o input vazio', () => {
		render(<RequestModifyActionEditor action={baseAction()} onChange={vi.fn()} />);
		expect(screen.getByTestId('request-modify-url-enabled')).not.toBeChecked();
		expect(screen.getByTestId('request-modify-url-input')).toBeDisabled();
	});

	test('habilitar override cria url vazia (não undefined) no payload', () => {
		const onChange = vi.fn();
		render(<RequestModifyActionEditor action={baseAction()} onChange={onChange} />);
		fireEvent.click(screen.getByTestId('request-modify-url-enabled'));
		expect(onChange).toHaveBeenCalledWith({
			type: 'requestModify',
			enabled: true,
			url: '',
		});
	});

	test('desabilitar override remove a chave url do payload', () => {
		const onChange = vi.fn();
		render(
			<RequestModifyActionEditor
				action={baseAction({ url: 'https://api.exemplo.com/x' })}
				onChange={onChange}
			/>,
		);
		fireEvent.click(screen.getByTestId('request-modify-url-enabled'));
		expect(onChange).toHaveBeenCalledWith({
			type: 'requestModify',
			enabled: true,
		});
	});
});

describe('RequestModifyActionEditor — Method override', () => {
	test('habilitar method preenche com GET default e dispara onChange', () => {
		const onChange = vi.fn();
		render(<RequestModifyActionEditor action={baseAction()} onChange={onChange} />);
		fireEvent.click(screen.getByTestId('request-modify-method-enabled'));
		expect(onChange).toHaveBeenCalledWith({
			type: 'requestModify',
			enabled: true,
			method: 'GET',
		});
	});
});

describe('RequestModifyActionEditor — Body tab', () => {
	test('body fica desabilitado até habilitar override', async () => {
		render(<RequestModifyActionEditor action={baseAction()} onChange={vi.fn()} />);
		await selectTab('Body');
		expect(screen.getByTestId('request-modify-body-enabled')).not.toBeChecked();
		expect(screen.getByTestId('request-modify-body-textarea')).toBeDisabled();
	});

	test('habilitar body cria string vazia e textarea editável', async () => {
		const onChange = vi.fn();
		render(<RequestModifyActionEditor action={baseAction()} onChange={onChange} />);
		await selectTab('Body');
		fireEvent.click(screen.getByTestId('request-modify-body-enabled'));
		expect(onChange).toHaveBeenCalledWith({
			type: 'requestModify',
			enabled: true,
			body: '',
		});
	});

	test('digitar no textarea atualiza body via onChange', async () => {
		const onChange = vi.fn();
		render(<RequestModifyActionEditor action={baseAction({ body: '' })} onChange={onChange} />);
		await selectTab('Body');
		fireEvent.change(screen.getByTestId('request-modify-body-textarea'), {
			target: { value: '{"foo": 1}' },
		});
		expect(onChange).toHaveBeenCalledWith({
			type: 'requestModify',
			enabled: true,
			body: '{"foo": 1}',
		});
	});
});

describe('RequestModifyActionEditor — Headers tab', () => {
	test('adicionar header em "set" propaga setHeaders no payload', async () => {
		const onChange = vi.fn();
		render(<RequestModifyActionEditor action={baseAction()} onChange={onChange} />);
		await selectTab('Headers');
		fireEvent.change(screen.getByTestId('request-modify-headers-set-name'), {
			target: { value: 'X-Custom' },
		});
		fireEvent.change(screen.getByTestId('request-modify-headers-set-value'), {
			target: { value: 'on' },
		});
		fireEvent.click(screen.getByTestId('request-modify-headers-set-add'));
		expect(onChange).toHaveBeenCalledWith(
			expect.objectContaining({
				setHeaders: { 'X-Custom': 'on' },
			}),
		);
	});

	test('remover headers gera removeHeaders como array', async () => {
		const onChange = vi.fn();
		render(<RequestModifyActionEditor action={baseAction()} onChange={onChange} />);
		await selectTab('Headers');
		fireEvent.change(screen.getByTestId('request-modify-headers-remove-name'), {
			target: { value: 'Authorization' },
		});
		fireEvent.click(screen.getByTestId('request-modify-headers-remove-add'));
		expect(onChange).toHaveBeenCalledWith(
			expect.objectContaining({
				removeHeaders: ['Authorization'],
			}),
		);
	});
});

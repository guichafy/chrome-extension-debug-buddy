import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { EditResponseDialog } from '../EditResponseDialog';
import type { InterceptedResponse } from '@/types/intercepted';

const baseRequest = (overrides: Partial<InterceptedResponse> = {}): InterceptedResponse => ({
	url: 'https://api.example.com/users/42',
	method: 'GET',
	status: 200,
	statusText: 'OK',
	headers: { 'content-type': 'application/json' },
	type: 'XHR',
	timestamp: 1,
	body: '{"id":42}',
	response: {
		headers: { 'content-type': 'application/json' },
		body: '{"id":42}',
	},
	isWaiting: true,
	...overrides,
});

describe('EditResponseDialog', () => {
	test('pré-preenche status, headers e body com valores capturados', () => {
		render(
			<EditResponseDialog
				open
				onOpenChange={() => {}}
				request={baseRequest()}
				requestId="req-1"
				onSubmit={vi.fn()}
			/>,
		);
		const statusInput = screen.getByTestId('edit-response-status-input') as HTMLInputElement;
		expect(statusInput.value).toBe('200');

		expect(screen.getByDisplayValue('content-type')).toBeInTheDocument();
		expect(screen.getByDisplayValue('application/json')).toBeInTheDocument();

		const bodyInput = screen.getByTestId('edit-response-body-input') as HTMLTextAreaElement;
		expect(bodyInput.value).toBe('{"id":42}');
	});

	test('submissão com payload válido envia status/headers/body editados', async () => {
		const onSubmit = vi.fn().mockResolvedValue({ success: true });
		const onOpenChange = vi.fn();
		render(
			<EditResponseDialog
				open
				onOpenChange={onOpenChange}
				request={baseRequest()}
				requestId="req-1"
				onSubmit={onSubmit}
			/>,
		);

		fireEvent.change(screen.getByTestId('edit-response-status-input'), {
			target: { value: '503' },
		});
		fireEvent.change(screen.getByDisplayValue('application/json'), {
			target: { value: 'text/plain' },
		});
		fireEvent.change(screen.getByTestId('edit-response-body-input'), {
			target: { value: 'new body' },
		});

		fireEvent.click(screen.getByTestId('edit-response-submit'));

		await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
		expect(onSubmit).toHaveBeenCalledWith('req-1', {
			status: 503,
			headers: { 'content-type': 'text/plain' },
			body: 'new body',
		});
		await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
	});

	test('renderiza toast de erro quando onSubmit retorna success=false', async () => {
		const onSubmit = vi.fn().mockResolvedValue({
			success: false,
			error: 'Fetch.fulfillRequest falhou: Tab closed',
		});
		const onOpenChange = vi.fn();
		render(
			<EditResponseDialog
				open
				onOpenChange={onOpenChange}
				request={baseRequest()}
				requestId="req-1"
				onSubmit={onSubmit}
			/>,
		);

		fireEvent.click(screen.getByTestId('edit-response-submit'));

		await waitFor(() => {
			expect(screen.getByTestId('edit-response-error-toast')).toBeInTheDocument();
		});
		expect(screen.getByTestId('edit-response-error-toast')).toHaveTextContent(
			'Fetch.fulfillRequest falhou: Tab closed',
		);
		// Dialog não fecha em caso de erro: o usuário precisa ver o toast.
		expect(onOpenChange).not.toHaveBeenCalledWith(false);
	});

	test('renderiza toast de erro quando onSubmit lança exceção', async () => {
		const onSubmit = vi.fn().mockRejectedValue(new Error('Boom'));
		render(
			<EditResponseDialog
				open
				onOpenChange={() => {}}
				request={baseRequest()}
				requestId="req-1"
				onSubmit={onSubmit}
			/>,
		);

		fireEvent.click(screen.getByTestId('edit-response-submit'));

		await waitFor(() => {
			expect(screen.getByTestId('edit-response-error-toast')).toHaveTextContent('Boom');
		});
	});

	test('valida status code fora de [100, 599] e bloqueia submit', () => {
		const onSubmit = vi.fn();
		render(
			<EditResponseDialog
				open
				onOpenChange={() => {}}
				request={baseRequest()}
				requestId="req-1"
				onSubmit={onSubmit}
			/>,
		);
		fireEvent.change(screen.getByTestId('edit-response-status-input'), {
			target: { value: '50' },
		});
		const submit = screen.getByTestId('edit-response-submit') as HTMLButtonElement;
		expect(submit.disabled).toBe(true);
		fireEvent.click(submit);
		expect(onSubmit).not.toHaveBeenCalled();
	});

	test('Cancelar fecha sem chamar onSubmit', () => {
		const onSubmit = vi.fn();
		const onOpenChange = vi.fn();
		render(
			<EditResponseDialog
				open
				onOpenChange={onOpenChange}
				request={baseRequest()}
				requestId="req-1"
				onSubmit={onSubmit}
			/>,
		);
		fireEvent.click(screen.getByRole('button', { name: /Cancelar/i }));
		expect(onOpenChange).toHaveBeenCalledWith(false);
		expect(onSubmit).not.toHaveBeenCalled();
	});

	test('avisa quando usuário edita Content-Length sem bloquear submit', async () => {
		const onSubmit = vi.fn().mockResolvedValue({ success: true });
		render(
			<EditResponseDialog
				open
				onOpenChange={() => {}}
				request={baseRequest({
					headers: { 'content-length': '12' },
					response: { headers: { 'content-length': '12' }, body: 'hello world!' },
					body: 'hello world!',
				})}
				requestId="req-1"
				onSubmit={onSubmit}
			/>,
		);

		fireEvent.click(screen.getByTestId('edit-response-submit'));

		await waitFor(() => {
			expect(screen.getByTestId('edit-response-warning-toast')).toBeInTheDocument();
		});
		expect(screen.getByTestId('edit-response-warning-toast')).toHaveTextContent('content-length');
		expect(onSubmit).toHaveBeenCalled();
	});

	test('permite remover headers existentes antes de enviar', async () => {
		const onSubmit = vi.fn().mockResolvedValue({ success: true });
		render(
			<EditResponseDialog
				open
				onOpenChange={() => {}}
				request={baseRequest({
					headers: { 'x-trace': 'abc', 'content-type': 'application/json' },
					response: {
						headers: { 'x-trace': 'abc', 'content-type': 'application/json' },
						body: '{}',
					},
					body: '{}',
				})}
				requestId="req-1"
				onSubmit={onSubmit}
			/>,
		);

		fireEvent.click(screen.getByLabelText('Remover header x-trace'));
		fireEvent.click(screen.getByTestId('edit-response-submit'));

		await waitFor(() => expect(onSubmit).toHaveBeenCalled());
		expect(onSubmit.mock.calls[0][1].headers).toEqual({ 'content-type': 'application/json' });
	});
});

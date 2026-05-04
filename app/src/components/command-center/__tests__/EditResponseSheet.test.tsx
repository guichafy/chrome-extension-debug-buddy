import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { EditResponseSheet } from '../EditResponseSheet';
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

describe('EditResponseSheet', () => {
	test('renderiza Method e URL no header em modo somente leitura', () => {
		render(
			<EditResponseSheet
				open
				onOpenChange={() => {}}
				request={baseRequest({ method: 'POST', url: 'https://api.example.com/orders' })}
				requestId="req-1"
				onSubmit={vi.fn()}
			/>,
		);

		expect(screen.getByTestId('edit-response-context-method')).toHaveTextContent('POST');
		expect(screen.getByTestId('edit-response-context-url')).toHaveTextContent(
			'https://api.example.com/orders',
		);
		// Não deve haver input editável dentro do bloco de contexto.
		const context = screen.getByTestId('edit-response-context');
		expect(context.querySelectorAll('input,textarea').length).toBe(0);
	});

	test('pré-preenche status, headers e body com valores capturados', () => {
		render(
			<EditResponseSheet
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

	test('"Aplicar e continuar" envia status/headers/body editados', async () => {
		const onSubmit = vi.fn().mockResolvedValue({ success: true });
		const onOpenChange = vi.fn();
		render(
			<EditResponseSheet
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
			<EditResponseSheet
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
		// Sheet não fecha em caso de erro: o usuário precisa ver o alerta.
		expect(onOpenChange).not.toHaveBeenCalledWith(false);
	});

	test('renderiza toast de erro quando onSubmit lança exceção', async () => {
		const onSubmit = vi.fn().mockRejectedValue(new Error('Boom'));
		render(
			<EditResponseSheet
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
			<EditResponseSheet
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

	test('header com chave vazia bloqueia submit e exibe erro inline', async () => {
		const onSubmit = vi.fn();
		render(
			<EditResponseSheet
				open
				onOpenChange={() => {}}
				request={baseRequest({
					headers: { 'content-type': 'application/json' },
					response: {
						headers: { 'content-type': 'application/json' },
						body: '{}',
					},
					body: '{}',
				})}
				requestId="req-1"
				onSubmit={onSubmit}
			/>,
		);

		fireEvent.click(screen.getByTestId('edit-response-add-header'));
		const headersList = screen.getByTestId('edit-response-headers');
		const valueInputs = headersList.querySelectorAll(
			'[data-testid^="edit-response-header-value-"]',
		);
		const lastValue = valueInputs[valueInputs.length - 1] as HTMLInputElement;
		fireEvent.change(lastValue, { target: { value: 'orfao' } });

		fireEvent.click(screen.getByTestId('edit-response-submit'));

		await waitFor(() => {
			const inlineErrors = headersList.querySelectorAll(
				'[data-testid^="edit-response-header-error-"]',
			);
			expect(inlineErrors.length).toBeGreaterThan(0);
		});
		expect(onSubmit).not.toHaveBeenCalled();
		expect(screen.getByTestId('edit-response-error-toast')).toHaveTextContent('chave vazia');
	});

	test('Cancelar fecha sem chamar onSubmit', () => {
		const onSubmit = vi.fn();
		const onOpenChange = vi.fn();
		render(
			<EditResponseSheet
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

	test('botões ficam desabilitados enquanto onSubmit está pendente', async () => {
		let resolveSubmit: (value: { success: boolean }) => void = () => {};
		const onSubmit = vi.fn(
			() =>
				new Promise<{ success: boolean }>((resolve) => {
					resolveSubmit = resolve;
				}),
		);
		render(
			<EditResponseSheet
				open
				onOpenChange={() => {}}
				request={baseRequest()}
				requestId="req-1"
				onSubmit={onSubmit}
			/>,
		);

		const submit = screen.getByTestId('edit-response-submit') as HTMLButtonElement;
		const cancel = screen.getByRole('button', { name: /Cancelar/i }) as HTMLButtonElement;
		fireEvent.click(submit);

		await waitFor(() => expect(submit.disabled).toBe(true));
		expect(cancel.disabled).toBe(true);
		expect(submit).toHaveTextContent(/Aplicando/);

		resolveSubmit({ success: true });
	});

	test('avisa quando usuário edita Content-Length sem bloquear submit', async () => {
		const onSubmit = vi.fn().mockResolvedValue({ success: true });
		render(
			<EditResponseSheet
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

	test('exibe aviso prominente quando bodyUnavailableReason está presente', () => {
		render(
			<EditResponseSheet
				open
				onOpenChange={() => {}}
				request={baseRequest({
					body: undefined,
					response: { headers: { 'content-type': 'application/json' }, body: undefined },
					bodyUnavailableReason: 'Body too large to capture (4MB)',
				})}
				requestId="req-1"
				onSubmit={vi.fn()}
			/>,
		);

		const warning = screen.getByTestId('edit-response-body-unavailable-warning');
		expect(warning).toBeInTheDocument();
		expect(warning).toHaveTextContent('Body too large to capture (4MB)');
		// O aviso anterior era apenas texto-muted; o novo é em destaque (warning toast).
		expect(warning).toHaveTextContent(/body vazio/i);
	});

	test('preserva edição do usuário quando o request troca de referência (polling) com mesmo requestId', () => {
		const onSubmit = vi.fn();
		const { rerender } = render(
			<EditResponseSheet
				open
				onOpenChange={() => {}}
				request={baseRequest()}
				requestId="req-1"
				onSubmit={onSubmit}
			/>,
		);

		// Usuário edita os três campos.
		fireEvent.change(screen.getByTestId('edit-response-status-input'), {
			target: { value: '503' },
		});
		fireEvent.change(screen.getByDisplayValue('application/json'), {
			target: { value: 'text/plain' },
		});
		fireEvent.change(screen.getByTestId('edit-response-body-input'), {
			target: { value: 'edição em andamento' },
		});

		// Simula o polling de useResponses (setInterval 2s): o background devolve a
		// mesma request, mas como passa pelo message channel a referência é nova.
		// Sem fix, o useEffect reseta o state local.
		rerender(
			<EditResponseSheet
				open
				onOpenChange={() => {}}
				request={baseRequest()}
				requestId="req-1"
				onSubmit={onSubmit}
			/>,
		);

		const statusInput = screen.getByTestId('edit-response-status-input') as HTMLInputElement;
		const bodyInput = screen.getByTestId('edit-response-body-input') as HTMLTextAreaElement;
		expect(statusInput.value).toBe('503');
		expect(bodyInput.value).toBe('edição em andamento');
		expect(screen.getByDisplayValue('text/plain')).toBeInTheDocument();
		// Garante que o valor original não voltou.
		expect(screen.queryByDisplayValue('application/json')).not.toBeInTheDocument();
	});

	test('reseta state ao trocar requestId enquanto o sheet está aberto', () => {
		const { rerender } = render(
			<EditResponseSheet
				open
				onOpenChange={() => {}}
				request={baseRequest()}
				requestId="req-1"
				onSubmit={vi.fn()}
			/>,
		);

		fireEvent.change(screen.getByTestId('edit-response-body-input'), {
			target: { value: 'editando req-1' },
		});

		rerender(
			<EditResponseSheet
				open
				onOpenChange={() => {}}
				request={baseRequest({
					url: 'https://api.example.com/orders/9',
					body: '{"order":9}',
					response: { headers: { 'content-type': 'application/json' }, body: '{"order":9}' },
				})}
				requestId="req-2"
				onSubmit={vi.fn()}
			/>,
		);

		const bodyInput = screen.getByTestId('edit-response-body-input') as HTMLTextAreaElement;
		expect(bodyInput.value).toBe('{"order":9}');
	});

	test('permite remover headers existentes antes de enviar', async () => {
		const onSubmit = vi.fn().mockResolvedValue({ success: true });
		render(
			<EditResponseSheet
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

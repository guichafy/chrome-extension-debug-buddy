import { fireEvent, render, screen, waitFor, act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import PendingResponses from '../PendingResponses';
import type { InterceptedResponse } from '@/types/intercepted';

// Mockamos o DropdownMenu do Radix porque o jsdom não tem o suporte completo a
// pointer events que ele exige; renderizamos o conteúdo inline para que os
// items fiquem no DOM e possam ser clicados normalmente nos testes.
vi.mock('@/components/ui/dropdown-menu', () => ({
	DropdownMenu: ({ children }: any) => <div data-testid="dropdown-menu">{children}</div>,
	DropdownMenuTrigger: ({ children }: any) => (
		<div data-testid="dropdown-menu-trigger">{children}</div>
	),
	DropdownMenuContent: ({ children }: any) => (
		<div data-testid="dropdown-menu-content">{children}</div>
	),
	DropdownMenuItem: ({ children, onSelect, className, ...rest }: any) => (
		<button
			type="button"
			className={className}
			onClick={() => onSelect?.({ preventDefault: () => {} })}
			{...rest}
		>
			{children}
		</button>
	),
	DropdownMenuSeparator: () => <hr data-testid="dropdown-menu-separator" />,
}));

// Captura o listener instalado por useResponses para podermos disparar
// mensagens do background diretamente nos testes.
let messageListener: ((message: any) => void) | null = null;

beforeEach(() => {
	messageListener = null;
	vi.mocked(chrome.runtime.onMessage.addListener).mockImplementation((cb: any) => {
		messageListener = cb;
	});
	vi.mocked(chrome.runtime.onMessage.removeListener).mockImplementation(() => {
		messageListener = null;
	});
	// useRules lê chrome.storage.local.get(['rules']); devolvemos array vazio
	// para evitar logs de erro/regressões transitivas dentro dos testes.
	vi.mocked(chrome.storage.local.get).mockResolvedValue({ rules: [] } as any);
});

afterEach(() => {
	vi.useRealTimers();
	vi.clearAllMocks();
});

const buildPending = (overrides: Partial<InterceptedResponse> = {}): InterceptedResponse => ({
	url: 'https://api.example.com/users',
	method: 'GET',
	status: 200,
	statusText: 'OK',
	headers: {},
	type: 'XHR',
	timestamp: 1,
	isWaiting: true,
	...overrides,
});

const mockGetPending = (entries: Record<string, InterceptedResponse>) => {
	vi.mocked(chrome.runtime.sendMessage).mockImplementation(((message: any) => {
		if (message?.action === 'getPendingResponses') {
			return Promise.resolve({ pendingResponses: entries });
		}
		if (message?.action === 'approveResponse') {
			return Promise.resolve({ success: true });
		}
		if (message?.action === 'approveResponseWithEdit') {
			return Promise.resolve({ success: true });
		}
		return Promise.resolve(undefined);
	}) as any);
};

describe('PendingResponses', () => {
	test('renderiza estado vazio quando não há pausadas', async () => {
		mockGetPending({});
		render(
			<MemoryRouter>
				<PendingResponses />
			</MemoryRouter>,
		);
		await waitFor(() => {
			expect(screen.getByTestId('pending-empty-state')).toBeInTheDocument();
		});
		expect(screen.getByText(/Nenhuma response aguardando decisão/i)).toBeInTheDocument();
		const link = screen.getByRole('link', { name: /Command Center/i });
		expect(link).toHaveAttribute('href', '/command-center');
	});

	test('lista 2 ou mais responses pausadas', async () => {
		mockGetPending({
			req1: buildPending({ url: 'https://api.example.com/users', timestamp: 1 }),
			req2: buildPending({
				url: 'https://api.example.com/orders',
				method: 'POST',
				timestamp: 2,
			}),
		});
		render(
			<MemoryRouter>
				<PendingResponses />
			</MemoryRouter>,
		);
		await waitFor(() => {
			expect(screen.getByTestId('pending-row-req1')).toBeInTheDocument();
		});
		expect(screen.getByTestId('pending-row-req2')).toBeInTheDocument();
		expect(screen.getByText('GET')).toBeInTheDocument();
		expect(screen.getByText('POST')).toBeInTheDocument();
		expect(screen.getByText(/2 requisições aguardando sua decisão/)).toBeInTheDocument();
	});

	test('filtra entradas com isWaiting != true', async () => {
		mockGetPending({
			req1: buildPending({ url: 'https://api.example.com/a' }),
			req2: buildPending({ url: 'https://api.example.com/b', isWaiting: false }),
		});
		render(
			<MemoryRouter>
				<PendingResponses />
			</MemoryRouter>,
		);
		await waitFor(() => {
			expect(screen.getByTestId('pending-row-req1')).toBeInTheDocument();
		});
		expect(screen.queryByTestId('pending-row-req2')).toBeNull();
	});

	test('remove linha em tempo real quando broadcast requestUpdated marca isWaiting=false', async () => {
		mockGetPending({
			req1: buildPending({ url: 'https://api.example.com/users', timestamp: 1 }),
			req2: buildPending({ url: 'https://api.example.com/orders', timestamp: 2 }),
		});
		render(
			<MemoryRouter>
				<PendingResponses />
			</MemoryRouter>,
		);
		await waitFor(() => {
			expect(screen.getByTestId('pending-row-req1')).toBeInTheDocument();
		});
		expect(messageListener).not.toBeNull();
		act(() => {
			messageListener?.({
				action: 'requestUpdated',
				requestId: 'req1',
				updates: { isWaiting: false },
			});
		});
		await waitFor(() => {
			expect(screen.queryByTestId('pending-row-req1')).toBeNull();
		});
		// req2 continua na tabela
		expect(screen.getByTestId('pending-row-req2')).toBeInTheDocument();
	});

	test('adiciona linha em tempo real quando broadcast newPendingResponse chega', async () => {
		mockGetPending({});
		render(
			<MemoryRouter>
				<PendingResponses />
			</MemoryRouter>,
		);
		await waitFor(() => {
			expect(screen.getByTestId('pending-empty-state')).toBeInTheDocument();
		});
		expect(messageListener).not.toBeNull();
		act(() => {
			messageListener?.({
				action: 'newPendingResponse',
				requestId: 'req1',
				response: buildPending({ url: 'https://api.example.com/new' }),
			});
		});
		await waitFor(() => {
			expect(screen.getByTestId('pending-row-req1')).toBeInTheDocument();
		});
	});

	test('click em "Aprovar" da linha dispara approveResponse com modifications vazias', async () => {
		mockGetPending({
			req1: buildPending({ url: 'https://api.example.com/users', timestamp: 1 }),
		});
		render(
			<MemoryRouter>
				<PendingResponses />
			</MemoryRouter>,
		);
		await waitFor(() => {
			expect(screen.getByTestId('pending-row-req1')).toBeInTheDocument();
		});
		const approveButton = screen.getByTestId('pending-actions-approve');
		fireEvent.click(approveButton);
		await waitFor(() => {
			expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
				expect.objectContaining({
					action: 'approveResponse',
					requestId: 'req1',
					modifications: {},
				}),
			);
		});
	});

	test('click em "Ignorar" do dropdown dispara approveResponse sem modifications', async () => {
		mockGetPending({
			req1: buildPending({ url: 'https://api.example.com/users', timestamp: 1 }),
		});
		render(
			<MemoryRouter>
				<PendingResponses />
			</MemoryRouter>,
		);
		await waitFor(() => {
			expect(screen.getByTestId('pending-row-req1')).toBeInTheDocument();
		});
		fireEvent.click(screen.getByTestId('pending-actions-ignore'));
		await waitFor(() => {
			const calls = vi.mocked(chrome.runtime.sendMessage).mock.calls;
			const ignoreCall = calls.find(
				(c) =>
					(c[0] as any)?.action === 'approveResponse' &&
					!('modifications' in (c[0] as any)) &&
					(c[0] as any)?.requestId === 'req1',
			);
			expect(ignoreCall).toBeTruthy();
		});
	});

	test('click em "Aprovar e editar" abre o EditResponseDialog para a linha', async () => {
		mockGetPending({
			req1: buildPending({ url: 'https://api.example.com/users', timestamp: 1 }),
		});
		render(
			<MemoryRouter>
				<PendingResponses />
			</MemoryRouter>,
		);
		await waitFor(() => {
			expect(screen.getByTestId('pending-row-req1')).toBeInTheDocument();
		});
		fireEvent.click(screen.getByTestId('pending-actions-edit'));
		await waitFor(() => {
			expect(screen.getByTestId('edit-response-dialog')).toBeInTheDocument();
		});
	});

	test('submit no EditResponseDialog dispara approveResponseWithEdit', async () => {
		mockGetPending({
			req1: buildPending({
				url: 'https://api.example.com/users',
				timestamp: 1,
				headers: { 'content-type': 'application/json' },
			}),
		});
		render(
			<MemoryRouter>
				<PendingResponses />
			</MemoryRouter>,
		);
		await waitFor(() => {
			expect(screen.getByTestId('pending-row-req1')).toBeInTheDocument();
		});
		fireEvent.click(screen.getByTestId('pending-actions-edit'));
		await waitFor(() => {
			expect(screen.getByTestId('edit-response-dialog')).toBeInTheDocument();
		});
		fireEvent.click(screen.getByTestId('edit-response-submit'));
		await waitFor(() => {
			expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
				expect.objectContaining({
					action: 'approveResponseWithEdit',
					requestId: 'req1',
					status: 200,
				}),
			);
		});
	});

	test('click em "Inspecionar" abre o RequestInspector em sheet sobre a tabela', async () => {
		mockGetPending({
			req1: buildPending({ url: 'https://api.example.com/users', timestamp: 1 }),
		});
		render(
			<MemoryRouter>
				<PendingResponses />
			</MemoryRouter>,
		);
		await waitFor(() => {
			expect(screen.getByTestId('pending-row-req1')).toBeInTheDocument();
		});
		fireEvent.click(screen.getByTestId('pending-row-inspect-req1'));
		await waitFor(() => {
			expect(screen.getByTestId('pending-inspect-sheet')).toBeInTheDocument();
		});
		// Header do inspector renderizado dentro do sheet
		expect(screen.getByTestId('request-inspector-header')).toBeInTheDocument();
		// Tabela continua existindo (sheet sobreposto, não navegação)
		expect(screen.getByTestId('pending-row-req1')).toBeInTheDocument();
	});

	test('click em "Criar Mock" do dropdown abre o QuickMockPanel', async () => {
		mockGetPending({
			req1: buildPending({ url: 'https://api.example.com/users', timestamp: 1 }),
		});
		render(
			<MemoryRouter>
				<PendingResponses />
			</MemoryRouter>,
		);
		await waitFor(() => {
			expect(screen.getByTestId('pending-row-req1')).toBeInTheDocument();
		});
		fireEvent.click(screen.getByTestId('pending-actions-create-mock'));
		await waitFor(() => {
			expect(screen.getByText(/Quick Mock/i)).toBeInTheDocument();
		});
	});

	test('cada linha tem seu próprio split button — ações por requestId', async () => {
		mockGetPending({
			req1: buildPending({ url: 'https://api.example.com/users', timestamp: 1 }),
			req2: buildPending({
				url: 'https://api.example.com/orders',
				method: 'POST',
				timestamp: 2,
			}),
		});
		render(
			<MemoryRouter>
				<PendingResponses />
			</MemoryRouter>,
		);
		await waitFor(() => {
			expect(screen.getByTestId('pending-row-req1')).toBeInTheDocument();
		});
		// Cada linha tem seu próprio botão Aprovar
		const approveButtons = screen.getAllByTestId('pending-actions-approve');
		expect(approveButtons).toHaveLength(2);
		// Click no primeiro envia req1; no segundo envia req2 (independente de seleção global)
		fireEvent.click(approveButtons[1]);
		await waitFor(() => {
			expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
				expect.objectContaining({
					action: 'approveResponse',
					requestId: 'req2',
					modifications: {},
				}),
			);
		});
	});
});

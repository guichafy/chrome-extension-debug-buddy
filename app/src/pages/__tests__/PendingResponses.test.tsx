import { render, screen, waitFor, act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import PendingResponses from '../PendingResponses';
import type { InterceptedResponse } from '@/types/intercepted';

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
});

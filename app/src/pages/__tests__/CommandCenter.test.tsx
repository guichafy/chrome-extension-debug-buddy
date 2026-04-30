import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { MemoryRouter, useLocation } from 'react-router-dom';
import CommandCenter from '../CommandCenter';
import type { Filter } from '@/types/filters';
import type { InterceptedResponse } from '@/types/intercepted';

// `vi.hoisted` permite que o factory do `vi.mock` (também hoisted) leia uma
// referência mutável definida no escopo do arquivo. Isso é o que permite
// alterar `pendingResponses` por teste sem reescrever o módulo inteiro.
const responseStubs = vi.hoisted(() => ({
	pendingResponses: {} as Record<string, unknown>,
	approveResponse: vi.fn(),
	approveResponseWithEdit: vi.fn(),
	ignoreResponse: vi.fn(),
	ignoreAllPending: vi.fn(),
}));

// Mock dos hooks com estado real (useState) para que o ciclo
// `URL → setFilters → re-render → setSearchParams → URL` funcione no teste.
vi.mock('@/hooks/useAllRequests', () => ({
	useAllRequests: () => {
		const [filters, setFilters] = React.useState<Filter[]>([]);
		return {
			filteredRequests: {},
			filters,
			setFilters,
			pauseAutoRefresh: vi.fn(),
			enableAutoRefresh: vi.fn(),
			autoRefreshEnabled: true,
			clearAllRequests: vi.fn().mockResolvedValue(true),
		};
	},
}));

vi.mock('@/hooks/useResponses', () => ({
	// `useState` no mock para que `ignoreAllPending` realmente esvazie o mapa
	// entre renders — assim conseguimos testar que o Dock desmonta após o
	// clique. O vi.fn de `responseStubs.ignoreAllPending` segue rastreando
	// chamadas; o wrapper só adiciona o setState local para espelhar o que o
	// hook real produziria via broadcasts `requestUpdated` do background.
	useResponses: () => {
		const [pending, setPending] = React.useState<Record<string, unknown>>(
			() => responseStubs.pendingResponses,
		);
		return {
			approveResponse: responseStubs.approveResponse,
			approveResponseWithEdit: responseStubs.approveResponseWithEdit,
			ignoreResponse: responseStubs.ignoreResponse,
			ignoreAllPending: async () => {
				responseStubs.ignoreAllPending();
				setPending({});
			},
			pendingResponses: pending,
		};
	},
}));

vi.mock('@/hooks/useRules', () => ({
	useRules: () => ({
		rules: [],
		addRule: vi.fn(),
		updateRule: vi.fn(),
		removeRule: vi.fn(),
		toggleRuleEnabled: vi.fn(),
	}),
}));

// Stub para o RequestTimeline que expõe os filtros e os mutators usados pelo
// FilterBar via test-ids — evita renderizar a DataTable + Radix popovers.
vi.mock('@/components/command-center/RequestTimeline', () => ({
	RequestTimeline: ({
		filters,
		onFiltersChange,
	}: {
		filters: Filter[];
		onFiltersChange: (next: Filter[]) => void;
	}) => (
		<div data-testid="request-timeline">
			<div data-testid="filters-snapshot">
				{filters.map((f) => `${f.field}:${f.operator}:${f.value}`).join('|')}
			</div>
			<button
				type="button"
				data-testid="filter-add-method-post"
				onClick={() =>
					onFiltersChange([
						...filters,
						{ id: 'new-method', field: 'method', operator: 'is', value: 'POST' },
					])
				}
			>
				add method
			</button>
			<button
				type="button"
				data-testid="filter-remove-last"
				onClick={() => onFiltersChange(filters.slice(0, -1))}
			>
				remove last
			</button>
			<button type="button" data-testid="filter-clear-all" onClick={() => onFiltersChange([])}>
				clear all
			</button>
		</div>
	),
}));

vi.mock('@/components/command-center/RequestInspector', () => ({
	RequestInspector: () => <div data-testid="request-inspector" />,
}));

vi.mock('@/components/command-center/QuickMockPanel', () => ({
	QuickMockPanel: () => <div data-testid="quick-mock-panel" />,
}));

vi.mock('@/components/command-center/usePendingHotkeys', () => ({
	usePendingHotkeys: () => undefined,
}));

// Sonda de localização: registra a search string a cada render para podermos
// inspecionar como ela evoluiu durante o ciclo de testes.
const locationProbe = { search: '' };

function LocationProbe() {
	const location = useLocation();
	locationProbe.search = location.search;
	return null;
}

function renderAt(initial: string) {
	locationProbe.search = '';
	return render(
		<MemoryRouter initialEntries={[initial]}>
			<LocationProbe />
			<CommandCenter />
		</MemoryRouter>,
	);
}

beforeEach(() => {
	vi.mocked(chrome.runtime.sendMessage).mockResolvedValue(undefined as any);
	vi.mocked(chrome.storage.local.get).mockResolvedValue({ rules: [] } as any);
	responseStubs.pendingResponses = {};
	responseStubs.approveResponse.mockResolvedValue(true);
	responseStubs.approveResponseWithEdit.mockResolvedValue(true);
	responseStubs.ignoreResponse.mockResolvedValue(true);
	responseStubs.ignoreAllPending.mockResolvedValue(undefined);
});

afterEach(() => {
	vi.clearAllMocks();
});

function pendingResponse(overrides: Partial<InterceptedResponse> = {}): InterceptedResponse {
	return {
		url: 'https://api.example.com/users/42',
		method: 'GET',
		status: 0,
		statusText: '',
		headers: {},
		type: 'XHR',
		timestamp: 1,
		isWaiting: true,
		...overrides,
	};
}

describe('CommandCenter — sincronização de filtros via URL', () => {
	test('lê o filtro inicial da URL (?filter=state:pending) e aplica ao FilterBar', async () => {
		renderAt('/command-center?filter=state:pending');
		await waitFor(() => {
			expect(screen.getByTestId('filters-snapshot')).toHaveTextContent('state:is:pending');
		});
	});

	test('adicionar um chip via FilterBar atualiza a URL com o novo parâmetro filter', async () => {
		renderAt('/command-center');
		await waitFor(() => {
			expect(screen.getByTestId('filters-snapshot')).toHaveTextContent('');
		});

		fireEvent.click(screen.getByTestId('filter-add-method-post'));

		await waitFor(() => {
			const params = new URLSearchParams(locationProbe.search);
			expect(params.getAll('filter')).toEqual(['method:POST']);
		});
	});

	test('remover o último chip atualiza a URL e remove totalmente o parâmetro filter quando esvazia', async () => {
		renderAt('/command-center?filter=state:pending&filter=method:GET');

		await waitFor(() => {
			const params = new URLSearchParams(locationProbe.search);
			expect(params.getAll('filter')).toEqual(['state:pending', 'method:GET']);
		});

		// Remove o último filtro adicionado
		fireEvent.click(screen.getByTestId('filter-remove-last'));
		await waitFor(() => {
			const params = new URLSearchParams(locationProbe.search);
			expect(params.getAll('filter')).toEqual(['state:pending']);
		});

		// Limpa todos os filtros — parâmetro deve sumir da URL
		fireEvent.click(screen.getByTestId('filter-clear-all'));
		await waitFor(() => {
			const params = new URLSearchParams(locationProbe.search);
			expect(params.has('filter')).toBe(false);
		});
	});
});

describe('CommandCenter — PendingActionDock', () => {
	test('Dock não monta quando não há pausadas', () => {
		responseStubs.pendingResponses = {};
		renderAt('/command-center');
		expect(screen.queryByTestId('pending-action-dock')).toBeNull();
	});

	test('Dock mostra contador, URL da próxima pausada e ações quando há pausadas', () => {
		responseStubs.pendingResponses = {
			r1: pendingResponse({ url: 'https://api.example.com/users/1', timestamp: 1 }),
			r2: pendingResponse({ url: 'https://api.example.com/users/2', timestamp: 2 }),
		};
		renderAt('/command-center');
		expect(screen.getByTestId('pending-action-dock')).toBeInTheDocument();
		expect(screen.getByTestId('pending-action-dock-counter')).toHaveTextContent('2 pausadas');
		expect(screen.getByTestId('pending-action-dock-next-url')).toHaveTextContent(
			'https://api.example.com/users/1',
		);
		expect(screen.getByTestId('pending-action-dock-approve-next')).toBeInTheDocument();
		expect(screen.getByTestId('pending-action-dock-view-pending')).toBeInTheDocument();
		expect(screen.getByTestId('pending-action-dock-ignore-all')).toBeInTheDocument();
	});

	test('clique em "Ver pausadas" no Dock muda a URL para ?filter=state:pending', async () => {
		responseStubs.pendingResponses = {
			r1: pendingResponse({ url: 'https://api.example.com/users/1', timestamp: 1 }),
		};
		renderAt('/command-center');

		fireEvent.click(screen.getByTestId('pending-action-dock-view-pending'));

		await waitFor(() => {
			const params = new URLSearchParams(locationProbe.search);
			expect(params.getAll('filter')).toEqual(['state:pending']);
		});
	});

	test('clique em "Ignorar todos" chama ignoreAllPending sem confirmação intermediária', async () => {
		responseStubs.pendingResponses = {
			r1: pendingResponse({ url: 'https://api.example.com/users/1', timestamp: 1 }),
			r2: pendingResponse({ url: 'https://api.example.com/users/2', timestamp: 2 }),
			r3: pendingResponse({ url: 'https://api.example.com/users/3', timestamp: 3 }),
		};
		renderAt('/command-center');

		expect(screen.getByTestId('pending-action-dock')).toBeInTheDocument();

		fireEvent.click(screen.getByTestId('pending-action-dock-ignore-all'));

		// Nenhum AlertDialog/diálogo de confirmação aparece — a ação é imediata.
		expect(screen.queryByRole('alertdialog')).toBeNull();
		expect(responseStubs.ignoreAllPending).toHaveBeenCalledTimes(1);
	});

	test('após ignorar todos, pendingResponses fica vazio e o Dock desmonta', async () => {
		responseStubs.pendingResponses = {
			r1: pendingResponse({ url: 'https://api.example.com/users/1', timestamp: 1 }),
			r2: pendingResponse({ url: 'https://api.example.com/users/2', timestamp: 2 }),
		};
		renderAt('/command-center');

		expect(screen.getByTestId('pending-action-dock')).toBeInTheDocument();

		fireEvent.click(screen.getByTestId('pending-action-dock-ignore-all'));

		await waitFor(() => {
			expect(screen.queryByTestId('pending-action-dock')).toBeNull();
		});
	});

	test('clique em "Editar próxima…" abre o EditResponseSheet com a primeira pausada', async () => {
		responseStubs.pendingResponses = {
			r1: pendingResponse({ url: 'https://api.example.com/users/1', timestamp: 1 }),
			r2: pendingResponse({ url: 'https://api.example.com/users/2', timestamp: 2 }),
		};
		renderAt('/command-center');

		fireEvent.click(screen.getByTestId('pending-action-dock-edit-next'));

		await waitFor(() => {
			const sheet = screen.getByTestId('edit-response-sheet');
			expect(sheet).toBeInTheDocument();
			expect(screen.getByTestId('edit-response-context-url')).toHaveTextContent(
				'https://api.example.com/users/1',
			);
		});
	});
});

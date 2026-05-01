import React from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { useLocation } from 'react-router-dom';
import CommandCenterPage from '../CommandCenter';
import { renderWithLayout } from '@/test/renderWithLayout';
import type { Filter } from '@/types/filters';

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
				const ids = Object.keys(pending);
				setPending({});
				return { succeeded: ids.length, failed: [] };
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

vi.mock('@/hooks/useDebugging', () => ({
	useDebugging: () => ({
		isDebugging: false,
		targetTab: null,
		startDebugging: vi.fn(),
		stopDebugging: vi.fn(),
	}),
}));
vi.mock('@/hooks/useSessionMarker', () => ({
	useSessionMarker: () => ({ start: null }),
}));
vi.mock('@/hooks/useNetworkMetrics', () => ({
	useNetworkMetrics: () => ({
		sessionDetails: null,
		currentPageDetails: null,
	}),
}));
vi.mock('@/components/layout/AppSidebar', () => ({ AppSidebar: () => null }));
vi.mock('@/components/layout/SiteHeader', () => ({ SiteHeader: () => null }));
vi.mock('@/components/select-tab/SelectTabDialog', () => ({ SelectTabDialog: () => null }));

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
	return renderWithLayout({
		initialEntries: [initial],
		routes: [
			{
				path: 'command-center',
				element: (
					<>
						<LocationProbe />
						<CommandCenterPage />
					</>
				),
			},
		],
	});
}

beforeEach(() => {
	vi.mocked(chrome.runtime.sendMessage).mockResolvedValue(undefined as any);
	vi.mocked(chrome.storage.local.get).mockResolvedValue({ rules: [] } as any);
	responseStubs.pendingResponses = {};
	responseStubs.approveResponse.mockResolvedValue(true);
	responseStubs.approveResponseWithEdit.mockResolvedValue(true);
	responseStubs.ignoreResponse.mockResolvedValue(true);
	responseStubs.ignoreAllPending.mockResolvedValue({ succeeded: 0, failed: [] });
});

afterEach(() => {
	vi.clearAllMocks();
});

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

import React from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { useLocation } from 'react-router-dom';
import CommandCenterPage from '../CommandCenter';
import { renderWithLayout } from '@/test/renderWithLayout';
import type { Filter } from '@/types/filters';
import type { PendingInterception } from '@/lib/interceptionPipeline';

function interceptedResponse(
	overrides: Partial<{
		url: string;
		method: string;
		status: number;
		statusText: string;
		headers: Record<string, string>;
		type: string;
		timestamp: number;
		isWaiting: boolean;
	}> = {},
) {
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

function pendingInterception(overrides: Partial<PendingInterception> = {}): PendingInterception {
	return {
		stage: 'response',
		requestId: overrides.requestId ?? 'req',
		ruleId: '',
		url: 'https://api.example.com/users/42',
		method: 'GET',
		request: { headers: {} },
		response: { status: 0, statusPhrase: '', headers: {} },
		...overrides,
	};
}

// `vi.hoisted` permite que o factory do `vi.mock` (também hoisted) leia uma
// referência mutável definida no escopo do arquivo. Isso é o que permite
// alterar `pendingResponses` por teste sem reescrever o módulo inteiro.
const interceptionStubs = vi.hoisted(() => ({
	pendingInterceptions: {} as Record<string, unknown>,
	filteredRequests: {} as Record<string, unknown>,
	approveInterception: vi.fn(),
	approveInterceptionWithEdit: vi.fn(),
	cancelInterception: vi.fn(),
	ignoreAllPending: vi.fn(),
}));

// Mock dos hooks com estado real (useState) para que o ciclo
// `URL → setFilters → re-render → setSearchParams → URL` funcione no teste.
vi.mock('@/hooks/useAllRequests', () => ({
	useAllRequests: () => {
		const [filters, setFilters] = React.useState<Filter[]>([]);
		return {
			filteredRequests: interceptionStubs.filteredRequests,
			filters,
			setFilters,
			clearAllRequests: vi.fn().mockResolvedValue(true),
		};
	},
}));

vi.mock('@/hooks/usePendingInterceptions', () => ({
	usePendingInterceptions: () => {
		const [pending, setPending] = React.useState<Record<string, unknown>>(
			() => interceptionStubs.pendingInterceptions,
		);
		return {
			approveInterception: interceptionStubs.approveInterception,
			approveInterceptionWithEdit: interceptionStubs.approveInterceptionWithEdit,
			cancelInterception: interceptionStubs.cancelInterception,
			ignoreAllPending: async () => {
				interceptionStubs.ignoreAllPending();
				const ids = Object.keys(pending);
				setPending({});
				return { succeeded: ids.length, failed: [] };
			},
			pendingInterceptions: pending,
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

vi.mock('@/components/rules/RuleEditor', () => ({
	__esModule: true,
	default: ({ onOpenChange }: { onOpenChange?: (open: boolean) => void }) => (
		<div data-testid="rule-editor">
			<button type="button" data-testid="rule-editor-close" onClick={() => onOpenChange?.(false)}>
				close
			</button>
		</div>
	),
}));

vi.mock('@/components/command-center/PendingInterceptionDialog', () => ({
	PendingInterceptionDialog: ({
		entry,
		onOpenChange,
	}: {
		entry: { url: string };
		onOpenChange: (open: boolean) => void;
	}) => (
		<div data-testid="pending-interception-dialog">
			<div data-testid="edit-response-context-url">{entry.url}</div>
			<button
				type="button"
				data-testid="pending-interception-dialog-close"
				onClick={() => onOpenChange(false)}
			>
				close
			</button>
		</div>
	),
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
		session: {
			totalRequests: 0,
			totalBytes: null,
			totalResourceBytes: null,
			avgTtfbMs: null,
			slowCount: 0,
			failedCount: 0,
		},
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
	interceptionStubs.pendingInterceptions = {};
	interceptionStubs.filteredRequests = {};
	interceptionStubs.approveInterception.mockResolvedValue(true);
	interceptionStubs.approveInterceptionWithEdit.mockResolvedValue(true);
	interceptionStubs.approveInterception.mockResolvedValue(true);
	interceptionStubs.ignoreAllPending.mockResolvedValue({ succeeded: 0, failed: [] });
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

describe('CommandCenter — hidratação de ?edit / ?createRule', () => {
	test('?edit=<id> presente no mount abre o EditResponseSheet com a request alvo', async () => {
		interceptionStubs.pendingInterceptions = {
			'r-edit-1': pendingInterception({ url: 'https://api.example.com/edit-target' }),
		};
		renderAt('/command-center?edit=r-edit-1');

		await waitFor(() => {
			expect(screen.getByTestId('pending-interception-dialog')).toBeInTheDocument();
			expect(screen.getByTestId('edit-response-context-url')).toHaveTextContent(
				'https://api.example.com/edit-target',
			);
		});
	});

	test('?createRule=<id>&type=mock presente no mount abre o RuleEditor', async () => {
		interceptionStubs.filteredRequests = {
			'r-mock-1': interceptedResponse({ url: 'https://api.example.com/mock-target' }),
		};
		renderAt('/command-center?createRule=r-mock-1&type=mock');

		await waitFor(() => {
			expect(screen.getByTestId('rule-editor')).toBeInTheDocument();
		});
	});

	test('?edit com id inválido (não está em pendingResponses) limpa o param sem abrir sheet', async () => {
		interceptionStubs.pendingInterceptions = {};
		interceptionStubs.filteredRequests = {};
		renderAt('/command-center?edit=does-not-exist');

		await waitFor(() => {
			expect(screen.queryByTestId('pending-interception-dialog')).toBeNull();
			const params = new URLSearchParams(locationProbe.search);
			expect(params.has('edit')).toBe(false);
		});
	});

	test('fechar EditResponseSheet remove o param ?edit da URL', async () => {
		interceptionStubs.pendingInterceptions = {
			'r-1': pendingInterception({ url: 'https://api.example.com/x' }),
		};
		renderAt('/command-center?edit=r-1');

		await waitFor(() => {
			expect(screen.getByTestId('pending-interception-dialog')).toBeInTheDocument();
		});

		fireEvent.click(screen.getByTestId('pending-interception-dialog-close'));

		await waitFor(() => {
			expect(screen.queryByTestId('pending-interception-dialog')).toBeNull();
			const params = new URLSearchParams(locationProbe.search);
			expect(params.has('edit')).toBe(false);
		});
	});

	test('?edit e ?createRule são mutuamente exclusivos — edit tem precedência', async () => {
		interceptionStubs.pendingInterceptions = {
			'r-1': pendingInterception({ url: 'https://api.example.com/x' }),
		};
		renderAt('/command-center?edit=r-1&createRule=r-1&type=mock');

		await waitFor(() => {
			// edit tem precedência se ambos chegam juntos; createRule/type são
			// silenciosamente removidos para não confundir.
			expect(screen.getByTestId('pending-interception-dialog')).toBeInTheDocument();
			expect(screen.queryByTestId('rule-editor')).toBeNull();
			const params = new URLSearchParams(locationProbe.search);
			expect(params.has('createRule')).toBe(false);
			expect(params.has('type')).toBe(false);
		});
	});

	test('?createRule com type inválido limpa ambos os params e não abre o RuleEditor', async () => {
		interceptionStubs.filteredRequests = {
			'r-mock-1': interceptedResponse({ url: 'https://api.example.com/mock-target' }),
		};
		renderAt('/command-center?createRule=r-mock-1&type=invalid');

		await waitFor(() => {
			expect(screen.queryByTestId('rule-editor')).toBeNull();
			const params = new URLSearchParams(locationProbe.search);
			expect(params.has('createRule')).toBe(false);
			expect(params.has('type')).toBe(false);
		});
	});

	test('?createRule sem type limpa ambos os params e não abre o RuleEditor', async () => {
		interceptionStubs.filteredRequests = {
			'r-mock-1': interceptedResponse({ url: 'https://api.example.com/mock-target' }),
		};
		renderAt('/command-center?createRule=r-mock-1');

		await waitFor(() => {
			expect(screen.queryByTestId('rule-editor')).toBeNull();
			const params = new URLSearchParams(locationProbe.search);
			expect(params.has('createRule')).toBe(false);
			expect(params.has('type')).toBe(false);
		});
	});

	test('fechar RuleEditor (onOpenChange(false)) remove createRule e type da URL', async () => {
		interceptionStubs.filteredRequests = {
			'r-mock-1': interceptedResponse({ url: 'https://api.example.com/mock-target' }),
		};
		renderAt('/command-center?createRule=r-mock-1&type=mock');

		await waitFor(() => {
			expect(screen.getByTestId('rule-editor')).toBeInTheDocument();
		});

		fireEvent.click(screen.getByTestId('rule-editor-close'));

		await waitFor(() => {
			expect(screen.queryByTestId('rule-editor')).toBeNull();
			const params = new URLSearchParams(locationProbe.search);
			expect(params.has('createRule')).toBe(false);
			expect(params.has('type')).toBe(false);
		});
	});
});

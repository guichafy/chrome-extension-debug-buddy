import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import Layout from '../Layout';
import type { Filter } from '@/types/filters';
import type { InterceptedResponse } from '@/types/intercepted';

const responseStubs = vi.hoisted(() => ({
	pendingResponses: {} as Record<string, unknown>,
	approveResponse: vi.fn(),
	approveResponseWithEdit: vi.fn(),
	ignoreResponse: vi.fn(),
	ignoreAllPending: vi.fn(),
}));

vi.mock('@/hooks/useAllRequests', () => ({
	useAllRequests: () => {
		const [filters, setFilters] = React.useState<Filter[]>([]);
		return {
			allRequests: {},
			filteredRequests: {},
			filters,
			setFilters,
			clearAllRequests: vi.fn().mockResolvedValue(true),
		};
	},
}));

vi.mock('@/hooks/useResponses', () => ({
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
	useRules: () => ({ rules: [] }),
}));

vi.mock('@/components/layout/AppSidebar', () => ({ AppSidebar: () => null }));
vi.mock('@/components/layout/SiteHeader', () => ({ SiteHeader: () => null }));
vi.mock('@/components/select-tab/SelectTabDialog', () => ({ SelectTabDialog: () => null }));
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

const locationProbe = { pathname: '', search: '' };

function LocationProbe() {
	const location = useLocation();
	locationProbe.pathname = location.pathname;
	locationProbe.search = location.search;
	return null;
}

function renderAt(initial: string) {
	locationProbe.pathname = '';
	locationProbe.search = '';
	return render(
		<MemoryRouter initialEntries={[initial]}>
			<Routes>
				<Route element={<Layout />}>
					<Route
						path="command-center"
						element={
							<>
								<LocationProbe />
								<div data-testid="command-center-stub">CC</div>
							</>
						}
					/>
					<Route
						path="rules-lab"
						element={
							<>
								<LocationProbe />
								<div data-testid="rules-lab-stub">RL</div>
							</>
						}
					/>
				</Route>
			</Routes>
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
	responseStubs.ignoreAllPending.mockResolvedValue({ succeeded: 0, failed: [] });
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

describe('Layout — PendingActionDock global', () => {
	test('Dock não monta quando não há pausadas', () => {
		responseStubs.pendingResponses = {};
		renderAt('/command-center');
		expect(screen.queryByTestId('pending-action-dock')).toBeNull();
	});

	test('Dock mostra contador, URL da próxima pausada e ações quando há pausadas (em /command-center)', () => {
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
	});

	test('clique em "Ignorar todos" chama ignoreAllPending sem confirmação intermediária', async () => {
		responseStubs.pendingResponses = {
			r1: pendingResponse({ url: 'https://api.example.com/users/1', timestamp: 1 }),
			r2: pendingResponse({ url: 'https://api.example.com/users/2', timestamp: 2 }),
		};
		renderAt('/command-center');

		fireEvent.click(screen.getByTestId('pending-action-dock-ignore-all'));

		expect(screen.queryByRole('alertdialog')).toBeNull();
		expect(responseStubs.ignoreAllPending).toHaveBeenCalledTimes(1);
	});

	test('após ignorar todos, pendingResponses fica vazio e o Dock desmonta', async () => {
		responseStubs.pendingResponses = {
			r1: pendingResponse({ url: 'https://api.example.com/users/1', timestamp: 1 }),
		};
		renderAt('/command-center');

		expect(screen.getByTestId('pending-action-dock')).toBeInTheDocument();

		fireEvent.click(screen.getByTestId('pending-action-dock-ignore-all'));

		await waitFor(() => {
			expect(screen.queryByTestId('pending-action-dock')).toBeNull();
		});
	});
});

describe('Layout — Dock cross-route', () => {
	test('Dock aparece em /rules-lab quando há pausadas', () => {
		responseStubs.pendingResponses = {
			r1: pendingResponse({ url: 'https://api.example.com/cross-route', timestamp: 1 }),
		};
		renderAt('/rules-lab');
		expect(screen.getByTestId('pending-action-dock')).toBeInTheDocument();
		expect(screen.getByTestId('pending-action-dock-next-url')).toHaveTextContent(
			'https://api.example.com/cross-route',
		);
	});

	test('clique em "Editar" partindo de /rules-lab navega para /command-center?edit=<id>', async () => {
		responseStubs.pendingResponses = {
			'r-rl-edit': pendingResponse({ url: 'https://api.example.com/from-rules-lab', timestamp: 1 }),
		};
		renderAt('/rules-lab');

		fireEvent.click(screen.getByTestId('pending-action-dock-edit-next'));

		await waitFor(() => {
			expect(locationProbe.pathname).toBe('/command-center');
			const params = new URLSearchParams(locationProbe.search);
			expect(params.get('edit')).toBe('r-rl-edit');
		});
	});

	test('clique em "Criar Mock" partindo de /rules-lab navega para /command-center?createRule=<id>&type=mock', async () => {
		responseStubs.pendingResponses = {
			'r-rl-mock': pendingResponse({ url: 'https://api.example.com/mock-from-rl', timestamp: 1 }),
		};
		renderAt('/rules-lab');

		fireEvent.click(screen.getByTestId('pending-action-dock-create-mock-next'));

		await waitFor(() => {
			expect(locationProbe.pathname).toBe('/command-center');
			const params = new URLSearchParams(locationProbe.search);
			expect(params.get('createRule')).toBe('r-rl-mock');
			expect(params.get('type')).toBe('mock');
		});
	});

	test('clique em "Ver pausadas" partindo de /rules-lab navega para /command-center', async () => {
		responseStubs.pendingResponses = {
			r1: pendingResponse({ url: 'https://api.example.com/x', timestamp: 1 }),
		};
		renderAt('/rules-lab');

		fireEvent.click(screen.getByTestId('pending-action-dock-view-pending'));

		await waitFor(() => {
			expect(locationProbe.pathname).toBe('/command-center');
		});
	});

	test('hotkey "A" partindo de /rules-lab aprova a primeira pausada', async () => {
		responseStubs.pendingResponses = {
			'r-hk-1': pendingResponse({ url: 'https://api.example.com/a', timestamp: 1 }),
			'r-hk-2': pendingResponse({ url: 'https://api.example.com/b', timestamp: 2 }),
		};
		renderAt('/rules-lab');

		fireEvent.keyDown(window, { key: 'a' });

		await waitFor(() => {
			expect(responseStubs.approveResponse).toHaveBeenCalledWith('r-hk-1', {});
		});
	});

	test('hotkey "I" partindo de /rules-lab ignora a primeira pausada', async () => {
		responseStubs.pendingResponses = {
			'r-hk-3': pendingResponse({ url: 'https://api.example.com/c', timestamp: 1 }),
		};
		renderAt('/rules-lab');

		fireEvent.keyDown(window, { key: 'i' });

		await waitFor(() => {
			expect(responseStubs.ignoreResponse).toHaveBeenCalledWith('r-hk-3');
		});
	});

	test('hotkey "J" com 2+ pausadas avança o ponteiro do Dock', async () => {
		responseStubs.pendingResponses = {
			'r-j-1': pendingResponse({ url: 'https://api.example.com/first', timestamp: 1 }),
			'r-j-2': pendingResponse({ url: 'https://api.example.com/second', timestamp: 2 }),
		};
		renderAt('/rules-lab');

		expect(screen.getByTestId('pending-action-dock-next-url')).toHaveTextContent(
			'https://api.example.com/first',
		);

		fireEvent.keyDown(window, { key: 'j' });

		await waitFor(() => {
			expect(screen.getByTestId('pending-action-dock-next-url')).toHaveTextContent(
				'https://api.example.com/second',
			);
		});
	});

	test('hotkey "K" com 2+ pausadas volta o ponteiro do Dock', async () => {
		responseStubs.pendingResponses = {
			'r-k-1': pendingResponse({ url: 'https://api.example.com/alpha', timestamp: 1 }),
			'r-k-2': pendingResponse({ url: 'https://api.example.com/beta', timestamp: 2 }),
		};
		renderAt('/rules-lab');

		fireEvent.keyDown(window, { key: 'j' });
		await waitFor(() => {
			expect(screen.getByTestId('pending-action-dock-next-url')).toHaveTextContent(
				'https://api.example.com/beta',
			);
		});

		fireEvent.keyDown(window, { key: 'k' });
		await waitFor(() => {
			expect(screen.getByTestId('pending-action-dock-next-url')).toHaveTextContent(
				'https://api.example.com/alpha',
			);
		});
	});

	test('hotkey "J" com apenas 1 pausada não muda nada (navEnabled=false)', () => {
		responseStubs.pendingResponses = {
			'r-only-1': pendingResponse({ url: 'https://api.example.com/only', timestamp: 1 }),
		};
		renderAt('/rules-lab');

		fireEvent.keyDown(window, { key: 'j' });
		expect(screen.getByTestId('pending-action-dock-next-url')).toHaveTextContent(
			'https://api.example.com/only',
		);
	});
});

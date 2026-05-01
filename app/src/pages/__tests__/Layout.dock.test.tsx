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
			pauseAutoRefresh: vi.fn(),
			enableAutoRefresh: vi.fn(),
			autoRefreshEnabled: true,
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
		sessionDetails: null,
		currentPageDetails: null,
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

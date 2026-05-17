import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import Layout from '../Layout';
import type { Filter } from '@/types/filters';
import type { PendingInterception } from '@/lib/interceptionPipeline';

const interceptionStubs = vi.hoisted(() => ({
	pendingInterceptions: {} as Record<string, unknown>,
	approveInterception: vi.fn(),
	approveInterceptionWithEdit: vi.fn(),
	cancelInterception: vi.fn(),
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
	interceptionStubs.pendingInterceptions = {};
	interceptionStubs.approveInterception.mockResolvedValue(true);
	interceptionStubs.approveInterceptionWithEdit.mockResolvedValue({ success: true });
	interceptionStubs.cancelInterception.mockResolvedValue(true);
	interceptionStubs.ignoreAllPending.mockResolvedValue({ succeeded: 0, failed: [] });
});

afterEach(() => {
	vi.clearAllMocks();
});

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

describe('Layout — PendingActionDock global', () => {
	test('Dock não monta quando não há pausadas', () => {
		interceptionStubs.pendingInterceptions = {};
		renderAt('/command-center');
		expect(screen.queryByTestId('pending-action-dock')).toBeNull();
	});

	test('Dock mostra contador, URL da próxima pausada e ações quando há pausadas (em /command-center)', () => {
		interceptionStubs.pendingInterceptions = {
			r1: pendingInterception({ url: 'https://api.example.com/users/1' }),
			r2: pendingInterception({ url: 'https://api.example.com/users/2' }),
		};
		renderAt('/command-center');
		expect(screen.getByTestId('pending-action-dock')).toBeInTheDocument();
		expect(screen.getByTestId('pending-action-dock-counter')).toHaveTextContent('2 pausadas');
		expect(screen.getByTestId('pending-action-dock-next-url')).toHaveTextContent(
			'https://api.example.com/users/1',
		);
	});

	test('clique em "Ignorar todos" chama ignoreAllPending sem confirmação intermediária', async () => {
		interceptionStubs.pendingInterceptions = {
			r1: pendingInterception({ url: 'https://api.example.com/users/1' }),
			r2: pendingInterception({ url: 'https://api.example.com/users/2' }),
		};
		renderAt('/command-center');

		fireEvent.click(screen.getByTestId('pending-action-dock-ignore-all'));

		expect(screen.queryByRole('alertdialog')).toBeNull();
		expect(interceptionStubs.ignoreAllPending).toHaveBeenCalledTimes(1);
	});

	test('após ignorar todos, pendingResponses fica vazio e o Dock desmonta', async () => {
		interceptionStubs.pendingInterceptions = {
			r1: pendingInterception({ url: 'https://api.example.com/users/1' }),
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
		interceptionStubs.pendingInterceptions = {
			r1: pendingInterception({ url: 'https://api.example.com/cross-route' }),
		};
		renderAt('/rules-lab');
		expect(screen.getByTestId('pending-action-dock')).toBeInTheDocument();
		expect(screen.getByTestId('pending-action-dock-next-url')).toHaveTextContent(
			'https://api.example.com/cross-route',
		);
	});

	test('clique em "Editar" partindo de /rules-lab navega para /command-center?edit=<id>', async () => {
		interceptionStubs.pendingInterceptions = {
			'r-rl-edit': pendingInterception({ url: 'https://api.example.com/from-rules-lab' }),
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
		interceptionStubs.pendingInterceptions = {
			'r-rl-mock': pendingInterception({ url: 'https://api.example.com/mock-from-rl' }),
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
		interceptionStubs.pendingInterceptions = {
			r1: pendingInterception({ url: 'https://api.example.com/x' }),
		};
		renderAt('/rules-lab');

		fireEvent.click(screen.getByTestId('pending-action-dock-view-pending'));

		await waitFor(() => {
			expect(locationProbe.pathname).toBe('/command-center');
		});
	});

	test('hotkey "A" partindo de /rules-lab aprova a primeira pausada', async () => {
		interceptionStubs.pendingInterceptions = {
			'r-hk-1': pendingInterception({ url: 'https://api.example.com/a' }),
			'r-hk-2': pendingInterception({ url: 'https://api.example.com/b' }),
		};
		renderAt('/rules-lab');

		fireEvent.keyDown(window, { key: 'a' });

		await waitFor(() => {
			expect(interceptionStubs.approveInterception).toHaveBeenCalledWith('r-hk-1');
		});
	});

	test('hotkey "I" partindo de /rules-lab ignora a primeira pausada', async () => {
		interceptionStubs.pendingInterceptions = {
			'r-hk-3': pendingInterception({ url: 'https://api.example.com/c' }),
		};
		renderAt('/rules-lab');

		fireEvent.keyDown(window, { key: 'i' });

		await waitFor(() => {
			expect(interceptionStubs.approveInterception).toHaveBeenCalledWith('r-hk-3');
		});
	});

	test('hotkey "J" com 2+ pausadas avança o ponteiro do Dock', async () => {
		interceptionStubs.pendingInterceptions = {
			'r-j-1': pendingInterception({ url: 'https://api.example.com/first' }),
			'r-j-2': pendingInterception({ url: 'https://api.example.com/second' }),
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
		interceptionStubs.pendingInterceptions = {
			'r-k-1': pendingInterception({ url: 'https://api.example.com/alpha' }),
			'r-k-2': pendingInterception({ url: 'https://api.example.com/beta' }),
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
		interceptionStubs.pendingInterceptions = {
			'r-only-1': pendingInterception({ url: 'https://api.example.com/only' }),
		};
		renderAt('/rules-lab');

		fireEvent.keyDown(window, { key: 'j' });
		expect(screen.getByTestId('pending-action-dock-next-url')).toHaveTextContent(
			'https://api.example.com/only',
		);
	});
});

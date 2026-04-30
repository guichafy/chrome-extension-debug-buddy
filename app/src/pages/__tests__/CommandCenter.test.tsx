import { render, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import CommandCenter from '../CommandCenter';

// Mock dos hooks que o CommandCenter usa — só nos importa setFilters aqui.
const setFiltersMock = vi.fn();

vi.mock('@/hooks/useAllRequests', () => ({
	useAllRequests: () => ({
		filteredRequests: {},
		filters: [],
		setFilters: setFiltersMock,
		pauseAutoRefresh: vi.fn(),
		enableAutoRefresh: vi.fn(),
		autoRefreshEnabled: true,
		clearAllRequests: vi.fn(),
	}),
}));

vi.mock('@/hooks/useResponses', () => ({
	useResponses: () => ({
		approveResponse: vi.fn(),
		ignoreResponse: vi.fn(),
		pendingResponses: {},
	}),
}));

vi.mock('@/hooks/useRules', () => ({
	useRules: () => ({ rules: [] }),
}));

vi.mock('@/hooks/useRequestSelection', () => ({
	useRequestSelection: () => ({
		selectedId: null,
		selected: null,
		select: vi.fn(),
		clear: vi.fn(),
	}),
}));

// Mocks superficiais dos componentes filhos para isolar o teste de hidratação.
vi.mock('@/components/command-center/RequestTimeline', () => ({
	RequestTimeline: () => <div data-testid="request-timeline" />,
}));
vi.mock('@/components/command-center/RequestInspector', () => ({
	RequestInspector: () => null,
}));
vi.mock('@/components/command-center/QuickMockPanel', () => ({
	QuickMockPanel: () => null,
}));
vi.mock('@/components/command-center/PendingAlertBanner', () => ({
	PendingAlertBanner: () => null,
}));
vi.mock('@/components/command-center/PendingActionDock', () => ({
	PendingActionDock: () => null,
}));
vi.mock('@/components/command-center/usePendingHotkeys', () => ({
	usePendingHotkeys: () => undefined,
}));

describe('CommandCenter — hidratação de URL', () => {
	beforeEach(() => {
		setFiltersMock.mockClear();
	});

	it('hidrata setFilters quando URL contém ?f=...', async () => {
		render(
			<MemoryRouter initialEntries={['/command-center?f=duration:gte:1000']}>
				<Routes>
					<Route path="/command-center" element={<CommandCenter />} />
				</Routes>
			</MemoryRouter>,
		);

		await waitFor(() => {
			expect(setFiltersMock).toHaveBeenCalledTimes(1);
		});
		const filtersArg = setFiltersMock.mock.calls[0]?.[0];
		expect(filtersArg).toHaveLength(1);
		expect(filtersArg[0]).toMatchObject({
			field: 'duration',
			operator: 'gte',
			value: '1000',
		});
	});

	it('não chama setFilters quando URL não tem ?f=', async () => {
		render(
			<MemoryRouter initialEntries={['/command-center']}>
				<Routes>
					<Route path="/command-center" element={<CommandCenter />} />
				</Routes>
			</MemoryRouter>,
		);

		// Damos um tick pra effect rodar
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(setFiltersMock).not.toHaveBeenCalled();
	});
});

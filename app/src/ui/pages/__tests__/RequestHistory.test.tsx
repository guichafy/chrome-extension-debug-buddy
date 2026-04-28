import React from 'react';
import { render, screen } from '@testing-library/react';
import RequestHistory from '../RequestHistory';
import { useAllRequests } from '../../hooks/useAllRequests';
import { useResponses } from '../../hooks/useResponses';
import { useRules } from '../../hooks/useRules';
import { useLocation } from 'react-router-dom';

vi.mock('../../hooks/useAllRequests');
vi.mock('../../hooks/useResponses');
vi.mock('../../hooks/useRules');
vi.mock('react-router-dom', () => ({
	useLocation: vi.fn().mockReturnValue({ pathname: '/request-history' }),
}));
vi.mock('@/backend/services/indexedDB', () => ({
	indexedDBService: {
		init: vi.fn().mockResolvedValue(undefined),
	},
}));

// Simplified RequestTable mock with search input
vi.mock('../../components/RequestTable', () => ({
	__esModule: true,
	default: ({ searchValue, onSearchChange }: any) => (
		<div data-testid="request-table">
			<input
				data-testid="search-input"
				placeholder="Pesquisar em qualquer campo..."
				value={searchValue}
				onChange={(e) => onSearchChange(e.target.value)}
			/>
		</div>
	),
}));

vi.mock('../../components/ResponseDialog', () => ({
	__esModule: true,
	default: () => <div data-testid="response-dialog" />,
}));

describe('RequestHistory Component', () => {
	beforeEach(() => {
		// Partial mock — only the fields exercised by this test are populated.
		vi.mocked(useResponses).mockReturnValue({
			ignoreResponse: vi.fn(),
			clearCurrentResponse: vi.fn(),
		} as any);

		// Partial mock — only the fields exercised by this test are populated.
		vi.mocked(useRules).mockReturnValue({
			addRule: vi.fn().mockResolvedValue(true),
		} as any);
	});

	it('keeps search input visible when there are no results', () => {
		// Partial mock — only the fields exercised by this test are populated.
		vi.mocked(useAllRequests).mockReturnValue({
			filteredRequests: {},
			currentRequestId: '',
			currentRequest: null,
			getRequestDetails: vi.fn(),
			filter: '',
			setFilter: vi.fn(),
			pauseAutoRefresh: vi.fn(),
			enableAutoRefresh: vi.fn(),
			autoRefreshEnabled: true,
			clearAllRequests: vi.fn(),
		} as any);

		render(<RequestHistory />);

		expect(screen.getByTestId('search-input')).toBeInTheDocument();
		expect(screen.getByText('Nenhuma requisição encontrada no histórico.')).toBeInTheDocument();
	});

	it('shows results table when there are requests', () => {
		// Partial mock — only the fields exercised by this test are populated.
		vi.mocked(useAllRequests).mockReturnValue({
			filteredRequests: { '1': { url: 'https://example.com' } },
			currentRequestId: '',
			currentRequest: null,
			getRequestDetails: vi.fn(),
			filter: '',
			setFilter: vi.fn(),
			pauseAutoRefresh: vi.fn(),
			enableAutoRefresh: vi.fn(),
			autoRefreshEnabled: true,
			clearAllRequests: vi.fn(),
		} as any);

		render(<RequestHistory />);

		expect(screen.getByTestId('search-input')).toBeInTheDocument();
		expect(
			screen.queryByText('Nenhuma requisição encontrada no histórico.'),
		).not.toBeInTheDocument();
	});
});

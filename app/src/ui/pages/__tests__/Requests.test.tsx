import React from 'react';
import { render, screen } from '@testing-library/react';
import Requests from '../Requests';
import { useResponses } from '../../hooks/useResponses';
import { useRules } from '../../hooks/useRules';
import { useLocation } from 'react-router-dom';

// Mock the hooks
vi.mock('../../hooks/useResponses');
vi.mock('../../hooks/useRules');
vi.mock('react-router-dom', () => ({
	useLocation: vi.fn().mockReturnValue({ pathname: '/requests' }),
}));
vi.mock('@/lib/indexedDB', () => ({
	indexedDBService: {
		init: vi.fn().mockResolvedValue(undefined),
	},
}));

// Mock the components
vi.mock('../../components/ResponseList', () => ({
	__esModule: true,
	default: ({ responses }: any) => (
		<div data-testid="response-list">{Object.keys(responses).length} responses</div>
	),
}));

vi.mock('../../components/ResponseDialog', () => ({
	__esModule: true,
	default: () => <div data-testid="response-dialog" />,
}));

describe('Requests Component', () => {
	beforeEach(() => {
		// Setup mock return values
		vi.mocked(useResponses).mockReturnValue({
			pendingResponses: { '1': { url: 'https://example.com' } },
			currentResponseId: '',
			currentResponse: null,
			getResponseDetails: vi.fn(),
			approveResponse: vi.fn(),
			ignoreResponse: vi.fn(),
			clearCurrentResponse: vi.fn(),
		} as any);

		// Partial mock — only the fields exercised by this test are populated.
		vi.mocked(useRules).mockReturnValue({
			addRule: vi.fn().mockResolvedValue(true),
		} as any);
	});

	it('renders the intercepted requests card', () => {
		render(<Requests />);

		// Check if the intercepted requests card is rendered
		expect(screen.getByText('Requisições Interceptadas')).toBeInTheDocument();

		// Check if the response list component is rendered
		expect(screen.getByTestId('response-list')).toBeInTheDocument();

		// Check if the dialog is rendered
		expect(screen.getByTestId('response-dialog')).toBeInTheDocument();
	});
});

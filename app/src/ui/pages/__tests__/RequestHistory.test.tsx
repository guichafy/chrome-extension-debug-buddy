import React from 'react';
import { render, screen } from '@testing-library/react';
import RequestHistory from '../RequestHistory';
import { useAllRequests } from '../../hooks/useAllRequests';
import { useResponses } from '../../hooks/useResponses';
import { useRules } from '../../hooks/useRules';
import { useLocation } from 'react-router-dom';

jest.mock('../../hooks/useAllRequests');
jest.mock('../../hooks/useResponses');
jest.mock('../../hooks/useRules');
jest.mock('react-router-dom', () => ({
  useLocation: jest.fn().mockReturnValue({ pathname: '/request-history' })
}));
jest.mock('@/backend/services/indexedDB', () => ({
  indexedDBService: {
    init: jest.fn().mockResolvedValue(undefined)
  }
}));

// Simplified RequestTable mock with search input
jest.mock('../../components/RequestTable', () => ({
  __esModule: true,
  default: ({ searchValue, onSearchChange }) => (
    <div data-testid="request-table">
      <input
        data-testid="search-input"
        placeholder="Pesquisar em qualquer campo..."
        value={searchValue}
        onChange={(e) => onSearchChange(e.target.value)}
      />
    </div>
  )
}));

jest.mock('../../components/ResponseDialog', () => ({
  __esModule: true,
  default: () => <div data-testid="response-dialog" />
}));

describe('RequestHistory Component', () => {
  beforeEach(() => {
    (useResponses as jest.Mock).mockReturnValue({
      ignoreResponse: jest.fn(),
      clearCurrentResponse: jest.fn()
    });

    (useRules as jest.Mock).mockReturnValue({
      addRule: jest.fn().mockResolvedValue(true)
    });
  });

  it('keeps search input visible when there are no results', () => {
    (useAllRequests as jest.Mock).mockReturnValue({
      filteredRequests: {},
      currentRequestId: '',
      currentRequest: null,
      getRequestDetails: jest.fn(),
      filter: '',
      setFilter: jest.fn(),
      pauseAutoRefresh: jest.fn(),
      enableAutoRefresh: jest.fn(),
      autoRefreshEnabled: true,
      clearAllRequests: jest.fn()
    });

    render(<RequestHistory />);

    expect(screen.getByTestId('search-input')).toBeInTheDocument();
    expect(
      screen.getByText('Nenhuma requisição encontrada no histórico.')
    ).toBeInTheDocument();
  });

  it('shows results table when there are requests', () => {
    (useAllRequests as jest.Mock).mockReturnValue({
      filteredRequests: { '1': { id: '1', url: 'https://example.com' } },
      currentRequestId: '',
      currentRequest: null,
      getRequestDetails: jest.fn(),
      filter: '',
      setFilter: jest.fn(),
      pauseAutoRefresh: jest.fn(),
      enableAutoRefresh: jest.fn(),
      autoRefreshEnabled: true,
      clearAllRequests: jest.fn()
    });

    render(<RequestHistory />);

    expect(screen.getByTestId('search-input')).toBeInTheDocument();
    expect(
      screen.queryByText('Nenhuma requisição encontrada no histórico.')
    ).not.toBeInTheDocument();
  });
});

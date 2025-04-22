import React from 'react';
import { render, screen } from '@testing-library/react';
import Requests from '../Requests';
import { useResponses } from '../../hooks/useResponses';
import { useAllRequests } from '../../hooks/useAllRequests';
import { useRules } from '../../hooks/useRules';
import { useLocation } from 'react-router-dom';

// Mock the hooks
jest.mock('../../hooks/useResponses');
jest.mock('../../hooks/useAllRequests');
jest.mock('../../hooks/useRules');
jest.mock('react-router-dom', () => ({
  useLocation: jest.fn().mockReturnValue({ pathname: '/requests' })
}));
jest.mock('../../services/indexedDB', () => ({
  indexedDBService: {
    init: jest.fn().mockResolvedValue(undefined)
  }
}));

// Mock the components
jest.mock('../../components/ResponseList', () => ({
  __esModule: true,
  default: ({ responses }) => (
    <div data-testid="response-list">
      {Object.keys(responses).length} responses
    </div>
  )
}));

jest.mock('../../components/RequestTable', () => ({
  __esModule: true,
  default: ({ requests }) => (
    <div data-testid="request-table">
      {Object.keys(requests).length} requests
    </div>
  )
}));

jest.mock('../../components/ResponseDialog', () => ({
  __esModule: true,
  default: () => <div data-testid="response-dialog" />
}));

describe('Requests Component', () => {
  beforeEach(() => {
    // Setup mock return values
    (useResponses as jest.Mock).mockReturnValue({
      pendingResponses: { '1': { id: '1', url: 'https://example.com' } },
      currentResponseId: '',
      currentResponse: null,
      getResponseDetails: jest.fn(),
      approveResponse: jest.fn(),
      ignoreResponse: jest.fn(),
      clearCurrentResponse: jest.fn()
    });

    (useAllRequests as jest.Mock).mockReturnValue({
      filteredRequests: { '2': { id: '2', url: 'https://example.com/api' } },
      currentRequestId: '',
      currentRequest: null,
      getRequestDetails: jest.fn(),
      filter: '',
      setFilter: jest.fn(),
      pauseAutoRefresh: jest.fn(),
      enableAutoRefresh: jest.fn(),
      autoRefreshEnabled: true
    });

    (useRules as jest.Mock).mockReturnValue({
      addRule: jest.fn().mockResolvedValue(true)
    });
  });

  it('renders both cards without tabs', () => {
    render(<Requests />);

    // Check if both cards are rendered
    expect(screen.getByText('Requisições Interceptadas')).toBeInTheDocument();
    expect(screen.getByText('Histórico de Requisições')).toBeInTheDocument();

    // Check if both components are rendered
    expect(screen.getByTestId('response-list')).toBeInTheDocument();
    expect(screen.getByTestId('request-table')).toBeInTheDocument();

    // Check if the dialog is rendered
    expect(screen.getByTestId('response-dialog')).toBeInTheDocument();
  });
});

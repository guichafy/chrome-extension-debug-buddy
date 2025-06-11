import React from 'react';
import { render, screen } from '@testing-library/react';
import Requests from '../Requests';
import { useResponses } from '../../hooks/useResponses';
import { useRules } from '../../hooks/useRules';
import { useLocation } from 'react-router-dom';

// Mock the hooks
jest.mock('../../hooks/useResponses');
jest.mock('../../hooks/useRules');
jest.mock('react-router-dom', () => ({
  useLocation: jest.fn().mockReturnValue({ pathname: '/requests' })
}));
jest.mock('../../../backend/services/indexedDB', () => ({
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

    (useRules as jest.Mock).mockReturnValue({
      addRule: jest.fn().mockResolvedValue(true)
    });
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

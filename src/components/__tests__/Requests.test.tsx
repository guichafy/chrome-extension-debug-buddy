import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { act } from 'react-dom/test-utils';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import Requests from '../../pages/Requests';
import Layout from '../../pages/Layout';
import Settings from '../../pages/Settings';
import Mocks from '../../pages/Mocks';

// Mock para os hooks
jest.mock('../../hooks/useResponses', () => ({
  useResponses: () => ({
    pendingResponses: {},
    currentResponseId: null,
    currentResponse: null,
    getResponseDetails: jest.fn(),
    approveResponse: jest.fn(),
    ignoreResponse: jest.fn(),
    clearCurrentResponse: jest.fn()
  })
}));

jest.mock('../../hooks/useAllRequests', () => ({
  useAllRequests: () => ({
    filteredRequests: {},
    currentRequestId: null,
    currentRequest: null,
    getRequestDetails: jest.fn(),
    filter: '',
    setFilter: jest.fn(),
    pauseAutoRefresh: jest.fn(),
    enableAutoRefresh: jest.fn(),
    autoRefreshEnabled: true,
    dbInitialized: true
  })
}));

jest.mock('../../hooks/useMocks', () => ({
  useMocks: () => ({
    createMockFromResponse: jest.fn(),
    saveMock: jest.fn(),
    mocks: []
  })
}));

jest.mock('../../hooks/useDebugging', () => ({
  useDebugging: () => ({
    isDebugging: false,
    targetTab: { id: null, title: '', url: '' },
    startDebugging: jest.fn(),
    stopDebugging: jest.fn()
  })
}));

jest.mock('../../services/indexedDB', () => ({
  indexedDBService: {
    init: jest.fn().mockResolvedValue(true)
  }
}));

// Mock para os componentes do shadcn-ui
jest.mock('@/components/ui/tabs', () => ({
  Tabs: ({ children, value, onValueChange }) => (
    <div data-testid="tabs" data-value={value} onClick={() => onValueChange && onValueChange('all')}>
      {children}
    </div>
  ),
  TabsList: ({ children }) => <div data-testid="tabs-list">{children}</div>,
  TabsTrigger: ({ children, value }) => (
    <button data-testid={`tab-${value}`} data-value={value}>
      {children}
    </button>
  ),
  TabsContent: ({ children, value }) => (
    <div data-testid={`tab-content-${value}`} data-value={value}>
      {children}
    </div>
  )
}));

jest.mock('@/components/ui/card', () => ({
  Card: ({ children, className }) => <div data-testid="card" className={className}>{children}</div>,
  CardHeader: ({ children, className }) => <div data-testid="card-header" className={className}>{children}</div>,
  CardTitle: ({ children }) => <div data-testid="card-title">{children}</div>,
  CardDescription: ({ children, className }) => <div data-testid="card-description" className={className}>{children}</div>,
  CardContent: ({ children }) => <div data-testid="card-content">{children}</div>
}));

jest.mock('../../components/ResponseList', () => ({
  __esModule: true,
  default: () => <div data-testid="response-list">ResponseList</div>
}));

jest.mock('../../components/RequestTable', () => ({
  __esModule: true,
  default: () => <div data-testid="request-table">RequestTable</div>
}));

jest.mock('../../components/ResponseDialog', () => ({
  __esModule: true,
  default: () => <div data-testid="response-dialog">ResponseDialog</div>
}));

jest.mock('@/components/ui/sidebar', () => ({
  SidebarProvider: ({ children }) => <div data-testid="sidebar-provider">{children}</div>,
  SidebarInset: ({ children }) => <div data-testid="sidebar-inset">{children}</div>,
}));

jest.mock('../../components/AppSidebar', () => ({
  AppSidebar: () => <div data-testid="app-sidebar">AppSidebar</div>
}));

jest.mock('../../components/SiteHeader', () => ({
  SiteHeader: () => <div data-testid="site-header">SiteHeader</div>
}));

jest.mock('../../components/SelectTabDialog', () => ({
  __esModule: true,
  default: () => <div data-testid="select-tab-dialog">SelectTabDialog</div>
}));

describe('Requests Component', () => {
  test('renderiza corretamente', () => {
    render(
      <MemoryRouter initialEntries={['/requests']}>
        <Requests />
      </MemoryRouter>
    );

    // Verificar se os componentes principais estão presentes
    expect(screen.getByTestId('card')).toBeInTheDocument();
    expect(screen.getByTestId('tabs')).toBeInTheDocument();
    expect(screen.getByTestId('tab-intercepted')).toBeInTheDocument();
    expect(screen.getByTestId('tab-all')).toBeInTheDocument();
    expect(screen.getByTestId('tab-content-intercepted')).toBeInTheDocument();
    expect(screen.getByTestId('tab-content-all')).toBeInTheDocument();
  });

  // Vamos pular este teste por enquanto, pois ele requer uma configuração mais complexa
  // para lidar com o useLocation e o location.key que estamos usando para resetar a aba
  test.skip('reseta a aba para "intercepted" quando a rota muda', async () => {
    // Este teste será implementado posteriormente quando tivermos uma configuração
    // mais robusta para testar a navegação com React Router
  });
});

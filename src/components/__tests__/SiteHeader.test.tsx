import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { SiteHeader } from '../SiteHeader';

// Mock para os componentes do shadcn-ui
jest.mock('@/components/ui/separator', () => ({
  Separator: ({ orientation, className }) => (
    <div data-testid="separator" data-orientation={orientation} className={className}></div>
  )
}));

jest.mock('@/components/ui/sidebar', () => ({
  SidebarTrigger: ({ className }) => (
    <button data-testid="sidebar-trigger" className={className}>Toggle</button>
  )
}));

describe('SiteHeader Component', () => {
  const mockProps = {
    targetTab: { id: 123, title: 'Test Tab', url: 'https://example.com' },
    isDebugging: false,
    pendingResponsesCount: 0,
    onSelectTabClick: jest.fn(),
    onStartDebugging: jest.fn(),
    onStopDebugging: jest.fn()
  };

  // Teste básico de renderização
  test('renderiza corretamente', () => {
    render(<SiteHeader {...mockProps} />);

    // Verifica se o SidebarTrigger está presente
    expect(screen.getByTestId('sidebar-trigger')).toBeTruthy();
    
    // Verifica se o separador está presente
    expect(screen.getByTestId('separator')).toBeTruthy();
    
    // Verifica se o título está presente
    expect(screen.getByText('Network Request Interceptor')).toBeTruthy();
    
    // Verifica se o botão de selecionar aba está presente
    expect(screen.getByText('Test Tab')).toBeTruthy();
    
    // Verifica se o botão de iniciar interceptação está presente
    expect(screen.getByText('Iniciar Interceptação')).toBeTruthy();
  });

  // Teste para verificar se o botão de selecionar aba chama a função correta
  test('chama onSelectTabClick quando o botão de selecionar aba é clicado', () => {
    render(<SiteHeader {...mockProps} />);
    
    const selectTabButton = screen.getByText('Test Tab').closest('button');
    fireEvent.click(selectTabButton);
    
    expect(mockProps.onSelectTabClick).toHaveBeenCalledTimes(1);
  });

  // Teste para verificar se o botão de iniciar interceptação chama a função correta
  test('chama onStartDebugging quando o botão de iniciar interceptação é clicado', () => {
    render(<SiteHeader {...mockProps} />);
    
    const startButton = screen.getByText('Iniciar Interceptação').closest('button');
    fireEvent.click(startButton);
    
    expect(mockProps.onStartDebugging).toHaveBeenCalledTimes(1);
  });

  // Teste para verificar se o botão de parar interceptação é exibido quando isDebugging é true
  test('exibe o botão de parar interceptação quando isDebugging é true', () => {
    render(<SiteHeader {...{...mockProps, isDebugging: true}} />);
    
    expect(screen.getByText('Parar Interceptação')).toBeTruthy();
    expect(screen.queryByText('Iniciar Interceptação')).toBeNull();
  });

  // Teste para verificar se o contador de respostas pendentes é exibido quando há respostas pendentes
  test('exibe o contador de respostas pendentes quando há respostas pendentes', () => {
    render(<SiteHeader {...{...mockProps, isDebugging: true, pendingResponsesCount: 5}} />);
    
    expect(screen.getByText('5')).toBeTruthy();
  });
});

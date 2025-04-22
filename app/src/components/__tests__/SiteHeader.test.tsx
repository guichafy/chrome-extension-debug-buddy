import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { SiteHeader } from '../SiteHeader';

// Mock para react-router-dom
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate
}));

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

jest.mock('@/components/ui/badge', () => ({
  Badge: ({ children, variant, className }) => (
    <span data-testid="badge" data-variant={variant} className={className}>{children}</span>
  )
}));

jest.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }) => <div data-testid="tooltip">{children}</div>,
  TooltipTrigger: ({ asChild, children }) => <div data-testid="tooltip-trigger">{children}</div>,
  TooltipContent: ({ side, children }) => <div data-testid="tooltip-content" data-side={side}>{children}</div>,
  TooltipProvider: ({ children }) => <div data-testid="tooltip-provider">{children}</div>
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

    // Verifica se o título está presente quando não há requisições pendentes
    const textosSemRequisicoes = screen.getAllByText('Nenhuma requisição interceptada');
    expect(textosSemRequisicoes.length).toBeGreaterThan(0);

    // Verifica se o botão de selecionar aba está presente
    // Usamos getAllByText e verificamos se pelo menos um elemento existe
    const tabButtons = screen.getAllByText('Test Tab');
    expect(tabButtons.length).toBeGreaterThan(0);

    // Verifica se o botão de iniciar interceptação está presente
    expect(screen.getByText('Iniciar Interceptação')).toBeTruthy();
  });

  // Teste para verificar se o botão de selecionar aba chama a função correta
  test('chama onSelectTabClick quando o botão de selecionar aba é clicado', () => {
    render(<SiteHeader {...mockProps} />);

    // Encontrar o botão pelo seu conteúdo e atributos
    const buttons = screen.getAllByRole('button');
    const selectTabButton = buttons.find(button =>
      button.textContent.includes('Test Tab') &&
      !button.textContent.includes('Iniciar') &&
      !button.textContent.includes('Parar')
    );

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

    // Verificar se o texto dinâmico está presente
    expect(screen.getByText('5 requisições aguardando')).toBeTruthy();

    // Verificar se o badge está presente
    const badges = screen.getAllByTestId('badge');
    expect(badges.length).toBeGreaterThan(0);
    expect(badges[0].textContent).toBe('5');
  });

  // Teste para verificar se o texto correto é exibido quando há apenas uma requisição pendente
  test('exibe texto correto quando há apenas uma requisição pendente', () => {
    render(<SiteHeader {...{...mockProps, pendingResponsesCount: 1}} />);

    // Verificar se o texto dinâmico está presente com a forma singular
    expect(screen.getByText('1 requisição aguardando')).toBeTruthy();
  });

  // Teste para verificar se o título com o contador redireciona para a página de requisições
  test('redireciona para a página de requisições ao clicar no título', () => {
    render(<SiteHeader {...{...mockProps, pendingResponsesCount: 3}} />);

    // Encontra o elemento que contém o título
    const titleElement = screen.getByText('3 requisições aguardando').closest('div');
    fireEvent.click(titleElement);

    // Verifica se a função de navegação foi chamada com o caminho correto
    expect(mockNavigate).toHaveBeenCalledWith('/requests');
  });

  // Teste para verificar se o badge é exibido apenas quando há requisições pendentes
  test('não exibe o badge quando não há requisições pendentes', () => {
    render(<SiteHeader {...mockProps} />); // pendingResponsesCount é 0

    // Não deve encontrar nenhum badge
    const badges = screen.queryAllByTestId('badge');
    expect(badges.length).toBe(0);
  });

  // Teste para verificar se o indicador de status pisca quando há requisições interceptadas pendentes
  test('indicador de status pisca quando há requisições interceptadas pendentes', () => {
    render(<SiteHeader {...{...mockProps, isDebugging: true, pendingResponsesCount: 3}} />);

    // Encontrar o indicador de status
    const statusIndicator = document.querySelector('.status-indicator-blinking');
    expect(statusIndicator).toBeTruthy();
  });

  // Teste para verificar se o indicador de status não pisca quando não há requisições pendentes
  test('indicador de status não pisca quando não há requisições pendentes', () => {
    render(<SiteHeader {...{...mockProps, isDebugging: true, pendingResponsesCount: 0}} />);

    // Não deve encontrar o indicador de status piscando
    const statusIndicator = document.querySelector('.status-indicator-blinking');
    expect(statusIndicator).toBeNull();
  });
});

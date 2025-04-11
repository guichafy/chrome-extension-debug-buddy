import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ResponseDetails from '../ResponseDetails';
import { InterceptedResponse } from '../../hooks/useResponses';

// Mock para os componentes do shadcn-ui
jest.mock('@/components/ui/card', () => ({
  Card: ({ children, className }) => (
    <div data-testid="card" className={className}>{children}</div>
  ),
  CardContent: ({ children, className }) => (
    <div data-testid="card-content" className={className}>{children}</div>
  )
}));

jest.mock('@/components/ui/badge', () => ({
  Badge: ({ children, variant, className }) => (
    <span data-testid="badge" data-variant={variant} className={className}>{children}</span>
  )
}));

jest.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, variant, size, className, disabled }) => (
    <button
      data-testid="button"
      data-variant={variant}
      data-size={size}
      className={className}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  )
}));

jest.mock('@/components/ui/input', () => ({
  Input: ({ id, value, onChange, disabled, className, type }) => (
    <input
      data-testid="input"
      id={id}
      value={value}
      onChange={onChange}
      disabled={disabled}
      className={className}
      type={type}
    />
  )
}));

jest.mock('@/components/ui/icon', () => ({
  Icon: ({ name, className }) => (
    <span data-testid="icon" data-name={name} className={className}>{name}</span>
  )
}));

jest.mock('@/components/ui/tabs', () => ({
  Tabs: ({ children, defaultValue, className }) => (
    <div data-testid="tabs" data-default-value={defaultValue} className={className}>{children}</div>
  ),
  TabsList: ({ children, className }) => (
    <div data-testid="tabs-list" className={className}>{children}</div>
  ),
  TabsTrigger: ({ children, value }) => (
    <button data-testid="tabs-trigger" data-value={value}>{children}</button>
  ),
  TabsContent: ({ children, value, className }) => (
    <div data-testid="tabs-content" data-value={value} className={className}>{children}</div>
  )
}));

jest.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: ({ children, className }) => (
    <div data-testid="scroll-area" className={className}>{children}</div>
  )
}));

describe('ResponseDetails Component', () => {
  const mockResponse: InterceptedResponse = {
    url: 'https://api.example.com/data',
    method: 'GET',
    status: 200,
    statusText: 'OK',
    headers: { 'Content-Type': 'application/json' },
    mimeType: 'application/json',
    type: 'xhr',
    timestamp: Date.now(),
    body: '{"data": "test"}'
  };

  const mockRequestId = 'req1';
  const mockOnApprove = jest.fn().mockResolvedValue(true);
  const mockOnIgnore = jest.fn().mockResolvedValue(true);
  const mockOnMock = jest.fn();
  const mockOnEdit = jest.fn();
  const mockOnCancel = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renderiza os detalhes da resposta corretamente', () => {
    render(
      <ResponseDetails
        response={mockResponse}
        requestId={mockRequestId}
        onApprove={mockOnApprove}
        onIgnore={mockOnIgnore}
        onMock={mockOnMock}
        onEdit={mockOnEdit}
        onCancel={mockOnCancel}
      />
    );

    // Verificar se o card foi renderizado
    expect(screen.getByTestId('card')).toBeInTheDocument();

    // Verificar se as informações básicas estão presentes
    expect(screen.getByText('Detalhes da Requisição')).toBeInTheDocument();
    expect(screen.getByText('https://api.example.com/data')).toBeInTheDocument();
    expect(screen.getByText('GET')).toBeInTheDocument();
    expect(screen.getByText('xhr')).toBeInTheDocument();
    expect(screen.getByText('application/json')).toBeInTheDocument();

    // Verificar se as abas estão presentes
    expect(screen.getByTestId('tabs')).toBeInTheDocument();
    expect(screen.getAllByTestId('tabs-trigger').length).toBe(3);
    expect(screen.getByText('Status')).toBeInTheDocument();
    expect(screen.getByText('Headers')).toBeInTheDocument();

    // Verificar se a aba Body está presente (usando getAllByText porque 'Body' aparece múltiplas vezes)
    const bodyElements = screen.getAllByText('Body');
    expect(bodyElements.length).toBeGreaterThan(0);

    // Verificar se os botões de ação estão presentes
    const buttons = screen.getAllByTestId('button');
    expect(buttons.length).toBe(4); // Criar Mock, Ignorar, Editar, Aprovar

    // Verificar se os campos de edição estão presentes
    expect(screen.getAllByTestId('input').length).toBe(2); // Status Code, Status Text
    expect(screen.getAllByTestId('scroll-area').length).toBe(2); // Headers, Body
  });

  test('permite editar os campos quando o botão Editar é clicado', async () => {
    render(
      <ResponseDetails
        response={mockResponse}
        requestId={mockRequestId}
        onApprove={mockOnApprove}
        onIgnore={mockOnIgnore}
        onMock={mockOnMock}
        onEdit={mockOnEdit}
        onCancel={mockOnCancel}
      />
    );

    // Encontrar o botão de editar e clicar nele
    const editButton = screen.getAllByTestId('button').find(button =>
      button.textContent.includes('Editar')
    );
    fireEvent.click(editButton);

    // Verificar se onEdit foi chamado
    expect(mockOnEdit).toHaveBeenCalled();

    // Verificar se o botão de cancelar aparece
    await waitFor(() => {
      const buttons = screen.getAllByTestId('button');
      const cancelButton = buttons.find(button => button.textContent.includes('Cancelar'));
      expect(cancelButton).toBeTruthy();
    });
  });

  test('chama onApprove quando o botão Aprovar é clicado', () => {
    render(
      <ResponseDetails
        response={mockResponse}
        requestId={mockRequestId}
        onApprove={mockOnApprove}
        onIgnore={mockOnIgnore}
        onMock={mockOnMock}
        onEdit={mockOnEdit}
        onCancel={mockOnCancel}
      />
    );

    // Encontrar o botão de aprovar e clicar nele
    const approveButton = screen.getAllByTestId('button').find(button =>
      button.textContent.includes('Aprovar')
    );
    fireEvent.click(approveButton);

    // Verificar se onApprove foi chamado com os parâmetros corretos
    expect(mockOnApprove).toHaveBeenCalledWith(mockRequestId, {});
  });

  test('chama onIgnore quando o botão Ignorar é clicado', () => {
    render(
      <ResponseDetails
        response={mockResponse}
        requestId={mockRequestId}
        onApprove={mockOnApprove}
        onIgnore={mockOnIgnore}
        onMock={mockOnMock}
        onEdit={mockOnEdit}
        onCancel={mockOnCancel}
      />
    );

    // Encontrar o botão de ignorar e clicar nele
    const ignoreButton = screen.getAllByTestId('button').find(button =>
      button.textContent.includes('Ignorar')
    );
    fireEvent.click(ignoreButton);

    // Verificar se onIgnore foi chamado com o ID correto
    expect(mockOnIgnore).toHaveBeenCalledWith(mockRequestId);
  });

  test('chama onMock quando o botão Criar Mock é clicado', () => {
    render(
      <ResponseDetails
        response={mockResponse}
        requestId={mockRequestId}
        onApprove={mockOnApprove}
        onIgnore={mockOnIgnore}
        onMock={mockOnMock}
        onEdit={mockOnEdit}
        onCancel={mockOnCancel}
      />
    );

    // Encontrar o botão de criar mock e clicar nele
    const mockButton = screen.getAllByTestId('button').find(button =>
      button.textContent.includes('Criar Mock')
    );
    fireEvent.click(mockButton);

    // Verificar se onMock foi chamado com a resposta correta
    expect(mockOnMock).toHaveBeenCalledWith(mockResponse);
  });

  test('não renderiza nada quando response ou requestId são null', () => {
    const { container } = render(
      <ResponseDetails
        response={null}
        requestId={null}
        onApprove={mockOnApprove}
        onIgnore={mockOnIgnore}
        onMock={mockOnMock}
        onEdit={mockOnEdit}
        onCancel={mockOnCancel}
      />
    );

    // Verificar se o componente não renderizou nada
    expect(container.firstChild).toBeNull();
  });
});

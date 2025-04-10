import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import RuleDialog from '../RuleDialog';
import { UrlPattern } from '../../hooks/useUrlPatterns';

// Mock dos componentes do Dialog
jest.mock('../ui/dialog', () => ({
  Dialog: ({ children, open }) => open ? <div data-testid="dialog">{children}</div> : null,
  DialogContent: ({ children }) => <div data-testid="dialog-content">{children}</div>,
  DialogHeader: ({ children }) => <div data-testid="dialog-header">{children}</div>,
  DialogTitle: ({ children }) => <div data-testid="dialog-title">{children}</div>,
  DialogDescription: ({ children }) => <div data-testid="dialog-description">{children}</div>,
  DialogFooter: ({ children }) => <div data-testid="dialog-footer">{children}</div>,
}));

// Mock do componente Button
jest.mock('../ui/button', () => ({
  Button: ({ children, onClick, disabled }) => {
    // Criar um ID de teste mais simples e consistente
    let testId = 'button-';
    if (typeof children === 'string') {
      testId += children.toLowerCase().replace(/\s+/g, '-');
    } else if (Array.isArray(children)) {
      // Se children for um array (como um ícone + texto), usar o último elemento se for string
      const lastChild = children[children.length - 1];
      if (typeof lastChild === 'string') {
        testId += lastChild.toLowerCase().replace(/\s+/g, '-');
      } else {
        testId += 'salvar'; // Fallback para o botão salvar
      }
    } else {
      testId += 'salvar'; // Fallback para o botão salvar
    }

    return (
      <button
        data-testid={testId}
        onClick={onClick}
        disabled={disabled}
      >
        {children}
      </button>
    );
  }
}));

// Mock do componente Icon
jest.mock('../ui/icon', () => ({
  Icon: ({ name }) => <span data-testid={`icon-${name}`}>{name}</span>
}));

describe('RuleDialog Component', () => {
  const mockRule: UrlPattern = {
    url: 'api.example.com',
    method: 'GET',
    headerType: 'request',
    headerName: 'Content-Type',
    headerValue: 'application/json',
    enabled: true
  };

  const mockOnOpenChange = jest.fn();
  const mockOnSave = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockOnSave.mockResolvedValue(true);
  });

  test('renderiza o diálogo quando open é true', () => {
    render(
      <RuleDialog
        open={true}
        rule={mockRule}
        onOpenChange={mockOnOpenChange}
        onSave={mockOnSave}
      />
    );

    // Verificar se o diálogo foi renderizado
    expect(screen.getByTestId('dialog')).toBeInTheDocument();
    expect(screen.getByTestId('dialog-title')).toHaveTextContent('Editar Regra');
  });

  test('não renderiza o diálogo quando open é false', () => {
    render(
      <RuleDialog
        open={false}
        rule={mockRule}
        onOpenChange={mockOnOpenChange}
        onSave={mockOnSave}
      />
    );

    // Verificar se o diálogo não foi renderizado
    expect(screen.queryByTestId('dialog')).not.toBeInTheDocument();
  });

  test('preenche os campos com os valores da regra', () => {
    render(
      <RuleDialog
        open={true}
        rule={mockRule}
        onOpenChange={mockOnOpenChange}
        onSave={mockOnSave}
      />
    );

    // Verificar se os campos foram preenchidos corretamente
    expect(screen.getByLabelText('Padrão de URL')).toHaveValue(mockRule.url);
    expect(screen.getByLabelText('Método HTTP')).toHaveValue(mockRule.method);
    expect(screen.getByLabelText('Tipo de Header')).toHaveValue(mockRule.headerType);
    expect(screen.getByLabelText('Nome do Header')).toHaveValue(mockRule.headerName);
    expect(screen.getByLabelText('Valor do Header')).toHaveValue(mockRule.headerValue);
    expect(screen.getByLabelText('Regra ativa')).toBeChecked();
  });

  test('chama onOpenChange quando o botão Cancelar é clicado', () => {
    render(
      <RuleDialog
        open={true}
        rule={mockRule}
        onOpenChange={mockOnOpenChange}
        onSave={mockOnSave}
      />
    );

    // Clicar no botão Cancelar
    fireEvent.click(screen.getByTestId('button-cancelar'));

    // Verificar se onOpenChange foi chamado com false
    expect(mockOnOpenChange).toHaveBeenCalledWith(false);
  });

  test('chama onSave com os valores atualizados quando o botão Salvar é clicado', async () => {
    render(
      <RuleDialog
        open={true}
        rule={mockRule}
        onOpenChange={mockOnOpenChange}
        onSave={mockOnSave}
      />
    );

    // Alterar os valores dos campos
    fireEvent.change(screen.getByLabelText('Padrão de URL'), { target: { value: 'api.example.com/v2' } });
    fireEvent.change(screen.getByLabelText('Método HTTP'), { target: { value: 'POST' } });
    fireEvent.change(screen.getByLabelText('Tipo de Header'), { target: { value: 'response' } });
    fireEvent.change(screen.getByLabelText('Nome do Header'), { target: { value: 'Authorization' } });
    fireEvent.change(screen.getByLabelText('Valor do Header'), { target: { value: 'Bearer token' } });
    fireEvent.click(screen.getByLabelText('Regra ativa')); // Desmarcar o checkbox

    // Clicar no botão Salvar
    fireEvent.click(screen.getByTestId('button-salvar'));

    // Verificar se onSave foi chamado com os valores atualizados
    await waitFor(() => {
      expect(mockOnSave).toHaveBeenCalledWith({
        url: 'api.example.com/v2',
        method: 'POST',
        headerType: 'response',
        headerName: 'Authorization',
        headerValue: 'Bearer token',
        enabled: false
      });
    });

    // Verificar se onOpenChange foi chamado com false após o salvamento bem-sucedido
    await waitFor(() => {
      expect(mockOnOpenChange).toHaveBeenCalledWith(false);
    });
  });

  test('não chama onOpenChange se onSave retornar false', async () => {
    mockOnSave.mockResolvedValue(false);

    render(
      <RuleDialog
        open={true}
        rule={mockRule}
        onOpenChange={mockOnOpenChange}
        onSave={mockOnSave}
      />
    );

    // Clicar no botão Salvar
    fireEvent.click(screen.getByTestId('button-salvar'));

    // Verificar se onSave foi chamado
    await waitFor(() => {
      expect(mockOnSave).toHaveBeenCalled();
    });

    // Verificar se onOpenChange não foi chamado
    expect(mockOnOpenChange).not.toHaveBeenCalled();
  });

  test('exibe alerta se o padrão de URL estiver vazio', async () => {
    // Mock do window.alert
    const alertMock = jest.spyOn(window, 'alert').mockImplementation(() => {});

    render(
      <RuleDialog
        open={true}
        rule={mockRule}
        onOpenChange={mockOnOpenChange}
        onSave={mockOnSave}
      />
    );

    // Limpar o campo de URL
    fireEvent.change(screen.getByLabelText('Padrão de URL'), { target: { value: '' } });

    // Clicar no botão Salvar
    fireEvent.click(screen.getByTestId('button-salvar'));

    // Verificar se o alerta foi exibido
    expect(alertMock).toHaveBeenCalledWith('Por favor, insira um padrão de URL');

    // Verificar se onSave não foi chamado
    expect(mockOnSave).not.toHaveBeenCalled();

    // Restaurar o mock
    alertMock.mockRestore();
  });
});

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import RuleList from '../RuleList';
import { UrlPattern } from '../../hooks/useUrlPatterns';

// Mock dos componentes do DataTable
jest.mock('../rules/data-table', () => ({
  DataTable: ({ columns, data, onRemove, onToggle, onEdit }) => (
    <div data-testid="data-table">
      <div data-testid="data-table-columns">{JSON.stringify(columns)}</div>
      <div data-testid="data-table-data">{JSON.stringify(data)}</div>
      <button 
        data-testid="remove-button" 
        onClick={() => onRemove(0)}
      >
        Remove
      </button>
      {onToggle && (
        <button 
          data-testid="toggle-button" 
          onClick={() => onToggle(0)}
        >
          Toggle
        </button>
      )}
      {onEdit && (
        <button 
          data-testid="edit-button" 
          onClick={() => onEdit(0, data[0] as UrlPattern)}
        >
          Edit
        </button>
      )}
    </div>
  )
}));

describe('RuleList Component', () => {
  const mockUrlPatterns: (string | UrlPattern)[] = [
    { url: 'api.example.com', method: 'GET', enabled: true },
    { url: 'api.test.com', method: 'POST', enabled: false }
  ];
  
  const mockOnRemove = jest.fn();
  const mockOnToggle = jest.fn();
  const mockOnEdit = jest.fn();
  
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  test('renderiza o componente DataTable com as props corretas', () => {
    render(
      <RuleList 
        urlPatterns={mockUrlPatterns} 
        onRemove={mockOnRemove} 
        onToggle={mockOnToggle}
        onEdit={mockOnEdit}
      />
    );
    
    // Verificar se o DataTable foi renderizado
    expect(screen.getByTestId('data-table')).toBeInTheDocument();
    
    // Verificar se os dados foram passados corretamente
    const dataElement = screen.getByTestId('data-table-data');
    expect(dataElement).toHaveTextContent(JSON.stringify(mockUrlPatterns));
  });
  
  test('chama a função onRemove quando o botão de remover é clicado', () => {
    render(
      <RuleList 
        urlPatterns={mockUrlPatterns} 
        onRemove={mockOnRemove} 
        onToggle={mockOnToggle}
        onEdit={mockOnEdit}
      />
    );
    
    // Clicar no botão de remover
    fireEvent.click(screen.getByTestId('remove-button'));
    
    // Verificar se a função onRemove foi chamada com o índice correto
    expect(mockOnRemove).toHaveBeenCalledWith(0);
  });
  
  test('chama a função onToggle quando o botão de alternar é clicado', () => {
    render(
      <RuleList 
        urlPatterns={mockUrlPatterns} 
        onRemove={mockOnRemove} 
        onToggle={mockOnToggle}
        onEdit={mockOnEdit}
      />
    );
    
    // Clicar no botão de alternar
    fireEvent.click(screen.getByTestId('toggle-button'));
    
    // Verificar se a função onToggle foi chamada com o índice correto
    expect(mockOnToggle).toHaveBeenCalledWith(0);
  });
  
  test('chama a função onEdit quando o botão de editar é clicado', () => {
    render(
      <RuleList 
        urlPatterns={mockUrlPatterns} 
        onRemove={mockOnRemove} 
        onToggle={mockOnToggle}
        onEdit={mockOnEdit}
      />
    );
    
    // Clicar no botão de editar
    fireEvent.click(screen.getByTestId('edit-button'));
    
    // Verificar se a função onEdit foi chamada com o índice e a regra corretos
    expect(mockOnEdit).toHaveBeenCalledWith(0, mockUrlPatterns[0] as UrlPattern);
  });
  
  test('funciona corretamente sem as funções opcionais', () => {
    render(
      <RuleList 
        urlPatterns={mockUrlPatterns} 
        onRemove={mockOnRemove} 
      />
    );
    
    // Verificar se o DataTable foi renderizado
    expect(screen.getByTestId('data-table')).toBeInTheDocument();
    
    // Verificar se o botão de remover está presente
    expect(screen.getByTestId('remove-button')).toBeInTheDocument();
    
    // Verificar se os botões opcionais não estão presentes
    expect(screen.queryByTestId('toggle-button')).not.toBeInTheDocument();
    expect(screen.queryByTestId('edit-button')).not.toBeInTheDocument();
  });
});

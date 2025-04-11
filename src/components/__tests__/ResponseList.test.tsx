import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import ResponseList from '../ResponseList';
import { InterceptedResponse } from '../../hooks/useResponses';

// Mock para os componentes do shadcn-ui
jest.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: ({ children, className }) => (
    <div data-testid="scroll-area" className={className}>{children}</div>
  )
}));

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
  Button: ({ children, onClick, variant, size, className, title }) => (
    <button 
      data-testid="button" 
      data-variant={variant}
      data-size={size}
      className={className}
      title={title}
      onClick={onClick}
    >
      {children}
    </button>
  )
}));

jest.mock('@/components/ui/icon', () => ({
  Icon: ({ name, className }) => (
    <span data-testid="icon" data-name={name} className={className}>{name}</span>
  )
}));

describe('ResponseList Component', () => {
  const mockResponses: Record<string, InterceptedResponse> = {
    'req1': {
      url: 'https://api.example.com/data',
      method: 'GET',
      status: 200,
      statusText: 'OK',
      headers: {},
      mimeType: 'application/json',
      type: 'xhr',
      timestamp: Date.now(),
      body: '{"data": "test"}',
      isWaiting: true
    },
    'req2': {
      url: 'https://api.example.com/users',
      method: 'POST',
      status: 201,
      statusText: 'Created',
      headers: {},
      mimeType: 'application/json',
      type: 'fetch',
      timestamp: Date.now() - 1000,
      body: '{"id": 123}',
      isWaiting: false
    }
  };
  
  const mockOnSelect = jest.fn();
  const mockOnIgnore = jest.fn().mockResolvedValue(true);
  
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  test('renderiza a lista de respostas corretamente', () => {
    render(
      <ResponseList 
        responses={mockResponses} 
        onSelect={mockOnSelect} 
        onIgnore={mockOnIgnore}
      />
    );
    
    // Verificar se o ScrollArea foi renderizado
    expect(screen.getByTestId('scroll-area')).toBeInTheDocument();
    
    // Verificar se os cards foram renderizados
    const cards = screen.getAllByTestId('card');
    expect(cards.length).toBe(2);
    
    // Verificar se as URLs estão presentes
    expect(screen.getByText('https://api.example.com/data')).toBeInTheDocument();
    expect(screen.getByText('https://api.example.com/users')).toBeInTheDocument();
    
    // Verificar se os métodos HTTP estão presentes
    expect(screen.getByText('GET')).toBeInTheDocument();
    expect(screen.getByText('POST')).toBeInTheDocument();
    
    // Verificar se os badges estão presentes
    const badges = screen.getAllByTestId('badge');
    expect(badges.length).toBe(2);
    expect(badges[0]).toHaveTextContent('Aguardando');
    expect(badges[1]).toHaveTextContent('Interceptado');
    
    // Verificar se os botões de ignorar estão presentes
    const buttons = screen.getAllByTestId('button');
    expect(buttons.length).toBe(2);
  });
  
  test('chama onSelect quando um item é clicado', () => {
    render(
      <ResponseList 
        responses={mockResponses} 
        onSelect={mockOnSelect} 
        onIgnore={mockOnIgnore}
      />
    );
    
    // Encontrar o primeiro item e clicar nele
    const firstItem = screen.getAllByTestId('card-content')[0];
    const clickableArea = firstItem.querySelector('div');
    fireEvent.click(clickableArea);
    
    // Verificar se onSelect foi chamado com o ID correto
    expect(mockOnSelect).toHaveBeenCalledWith('req1');
  });
  
  test('chama onIgnore quando o botão de ignorar é clicado', () => {
    render(
      <ResponseList 
        responses={mockResponses} 
        onSelect={mockOnSelect} 
        onIgnore={mockOnIgnore}
      />
    );
    
    // Encontrar o primeiro botão de ignorar e clicar nele
    const ignoreButtons = screen.getAllByTestId('button');
    fireEvent.click(ignoreButtons[0]);
    
    // Verificar se onIgnore foi chamado com o ID correto
    expect(mockOnIgnore).toHaveBeenCalledWith('req1');
    
    // Verificar se onSelect NÃO foi chamado (o evento não deve propagar)
    expect(mockOnSelect).not.toHaveBeenCalled();
  });
  
  test('exibe mensagem quando não há respostas', () => {
    render(
      <ResponseList 
        responses={{}} 
        onSelect={mockOnSelect} 
        onIgnore={mockOnIgnore}
      />
    );
    
    // Verificar se a mensagem de "nenhuma requisição" é exibida
    expect(screen.getByText('Nenhuma requisição interceptada')).toBeInTheDocument();
  });
});

import { renderHook, act } from '@testing-library/react';
import { useUrlPatterns } from '../useUrlPatterns';

// Mock do chrome.storage.local
const mockGet = jest.fn();
const mockSet = jest.fn();

beforeEach(() => {
  // Limpar mocks antes de cada teste
  mockGet.mockClear();
  mockSet.mockClear();
  
  // Configurar o mock do chrome.storage.local
  global.chrome = {
    ...global.chrome,
    storage: {
      local: {
        get: mockGet,
        set: mockSet
      }
    }
  };
});

describe('useUrlPatterns hook', () => {
  test('deve carregar padrões de URL do armazenamento', async () => {
    // Configurar o mock para retornar alguns padrões
    const mockPatterns = [
      { url: 'api.example.com', method: 'GET', enabled: true },
      { url: 'api.test.com', method: 'POST', enabled: false }
    ];
    
    mockGet.mockImplementation((keys, callback) => {
      callback({ urlPatterns: mockPatterns });
      return Promise.resolve({ urlPatterns: mockPatterns });
    });
    
    // Renderizar o hook
    const { result, rerender } = renderHook(() => useUrlPatterns());
    
    // Esperar que o hook carregue os padrões
    await act(async () => {
      await result.current.loadUrlPatterns();
    });
    
    // Verificar se o hook carregou os padrões corretamente
    expect(result.current.urlPatterns).toEqual(mockPatterns);
    expect(mockGet).toHaveBeenCalledWith(['urlPatterns']);
  });
  
  test('deve adicionar um novo padrão de URL', async () => {
    // Configurar o mock para retornar um array vazio inicialmente
    mockGet.mockImplementation((keys, callback) => {
      callback({ urlPatterns: [] });
      return Promise.resolve({ urlPatterns: [] });
    });
    
    // Renderizar o hook
    const { result } = renderHook(() => useUrlPatterns());
    
    // Esperar que o hook carregue os padrões
    await act(async () => {
      await result.current.loadUrlPatterns();
    });
    
    // Adicionar um novo padrão
    await act(async () => {
      await result.current.addUrlPattern(
        'api.example.com',
        'GET',
        'Content-Type',
        'application/json',
        'request'
      );
    });
    
    // Verificar se o padrão foi adicionado corretamente
    expect(mockSet).toHaveBeenCalledWith({
      urlPatterns: [
        {
          url: 'api.example.com',
          method: 'GET',
          headerType: 'request',
          headerName: 'Content-Type',
          headerValue: 'application/json',
          enabled: true
        }
      ]
    });
  });
  
  test('deve remover um padrão de URL', async () => {
    // Configurar o mock para retornar alguns padrões
    const mockPatterns = [
      { url: 'api.example.com', method: 'GET', enabled: true },
      { url: 'api.test.com', method: 'POST', enabled: false }
    ];
    
    mockGet.mockImplementation((keys, callback) => {
      callback({ urlPatterns: mockPatterns });
      return Promise.resolve({ urlPatterns: mockPatterns });
    });
    
    // Renderizar o hook
    const { result } = renderHook(() => useUrlPatterns());
    
    // Esperar que o hook carregue os padrões
    await act(async () => {
      await result.current.loadUrlPatterns();
    });
    
    // Remover um padrão
    await act(async () => {
      await result.current.removeUrlPattern(0);
    });
    
    // Verificar se o padrão foi removido corretamente
    expect(mockSet).toHaveBeenCalledWith({
      urlPatterns: [{ url: 'api.test.com', method: 'POST', enabled: false }]
    });
  });
  
  test('deve alternar o estado de habilitado/desabilitado de uma regra', async () => {
    // Configurar o mock para retornar alguns padrões
    const mockPatterns = [
      { url: 'api.example.com', method: 'GET', enabled: true },
      { url: 'api.test.com', method: 'POST', enabled: false }
    ];
    
    mockGet.mockImplementation((keys, callback) => {
      callback({ urlPatterns: mockPatterns });
      return Promise.resolve({ urlPatterns: mockPatterns });
    });
    
    // Renderizar o hook
    const { result } = renderHook(() => useUrlPatterns());
    
    // Esperar que o hook carregue os padrões
    await act(async () => {
      await result.current.loadUrlPatterns();
    });
    
    // Alternar o estado da primeira regra
    await act(async () => {
      await result.current.toggleRuleEnabled(0);
    });
    
    // Verificar se o estado foi alternado corretamente
    expect(mockSet).toHaveBeenCalledWith({
      urlPatterns: [
        { url: 'api.example.com', method: 'GET', enabled: false },
        { url: 'api.test.com', method: 'POST', enabled: false }
      ]
    });
    
    // Alternar o estado da segunda regra
    mockSet.mockClear();
    await act(async () => {
      await result.current.toggleRuleEnabled(1);
    });
    
    // Verificar se o estado foi alternado corretamente
    expect(mockSet).toHaveBeenCalledWith({
      urlPatterns: [
        { url: 'api.example.com', method: 'GET', enabled: false },
        { url: 'api.test.com', method: 'POST', enabled: true }
      ]
    });
  });
  
  test('deve atualizar uma regra existente', async () => {
    // Configurar o mock para retornar alguns padrões
    const mockPatterns = [
      { url: 'api.example.com', method: 'GET', enabled: true },
      { url: 'api.test.com', method: 'POST', enabled: false }
    ];
    
    mockGet.mockImplementation((keys, callback) => {
      callback({ urlPatterns: mockPatterns });
      return Promise.resolve({ urlPatterns: mockPatterns });
    });
    
    // Renderizar o hook
    const { result } = renderHook(() => useUrlPatterns());
    
    // Esperar que o hook carregue os padrões
    await act(async () => {
      await result.current.loadUrlPatterns();
    });
    
    // Atualizar a primeira regra
    const updatedRule = {
      url: 'api.example.com/v2',
      method: 'POST',
      headerType: 'request',
      headerName: 'Authorization',
      headerValue: 'Bearer token',
      enabled: true
    };
    
    await act(async () => {
      await result.current.updateUrlPattern(0, updatedRule);
    });
    
    // Verificar se a regra foi atualizada corretamente
    expect(mockSet).toHaveBeenCalledWith({
      urlPatterns: [
        updatedRule,
        { url: 'api.test.com', method: 'POST', enabled: false }
      ]
    });
  });
});

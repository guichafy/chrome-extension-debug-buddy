import { useState, useEffect, useCallback } from 'react';
import { InterceptedResponse } from './useResponses';

export interface MockConfig {
  urlPattern: string;
  method: string;
  status: number;
  headers: Record<string, string>;
  body: string;
  createdAt: number;
  enabled: boolean;
}

export function useMocks() {
  const [mocks, setMocks] = useState<MockConfig[]>([]);
  const [currentEditingMockIndex, setCurrentEditingMockIndex] = useState<number>(-1);
  const [loading, setLoading] = useState(true);

  // Carregar mocks do armazenamento
  const loadMocks = useCallback(async () => {
    setLoading(true);
    try {
      const result = await chrome.storage.local.get(['mocks']);
      setMocks(result.mocks || []);
    } catch (error) {
      console.error('Erro ao carregar mocks:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Salvar um mock
  const saveMock = useCallback(async (mockData: Omit<MockConfig, 'createdAt' | 'enabled'>): Promise<boolean> => {
    try {
      const newMock: MockConfig = {
        ...mockData,
        createdAt: Date.now(),
        enabled: true // Por padrão, novos mocks são habilitados
      };

      let newMocks: MockConfig[];
      
      if (currentEditingMockIndex >= 0 && currentEditingMockIndex < mocks.length) {
        // Atualizar mock existente
        newMocks = [...mocks];
        newMocks[currentEditingMockIndex] = {
          ...newMock,
          createdAt: mocks[currentEditingMockIndex].createdAt // Manter a data de criação original
        };
      } else {
        // Adicionar novo mock
        newMocks = [...mocks, newMock];
      }

      // Salvar mocks atualizados
      await chrome.storage.local.set({ mocks: newMocks });
      
      // Atualizar o estado
      setMocks(newMocks);
      setCurrentEditingMockIndex(-1);
      
      return true;
    } catch (error) {
      console.error('Erro ao salvar mock:', error);
      return false;
    }
  }, [mocks, currentEditingMockIndex]);

  // Remover um mock pelo índice
  const removeMock = useCallback(async (index: number): Promise<boolean> => {
    try {
      if (index < 0 || index >= mocks.length) {
        return false;
      }
      
      const newMocks = [...mocks];
      newMocks.splice(index, 1);
      
      // Salvar mocks atualizados
      await chrome.storage.local.set({ mocks: newMocks });
      
      // Atualizar o estado
      setMocks(newMocks);
      
      return true;
    } catch (error) {
      console.error('Erro ao remover mock:', error);
      return false;
    }
  }, [mocks]);

  // Alternar o estado de habilitado/desabilitado de um mock
  const toggleMockEnabled = useCallback(async (index: number): Promise<boolean> => {
    try {
      if (index < 0 || index >= mocks.length) {
        return false;
      }
      
      const newMocks = [...mocks];
      newMocks[index] = {
        ...newMocks[index],
        enabled: !newMocks[index].enabled
      };
      
      // Salvar mocks atualizados
      await chrome.storage.local.set({ mocks: newMocks });
      
      // Atualizar o estado
      setMocks(newMocks);
      
      return true;
    } catch (error) {
      console.error('Erro ao alternar estado do mock:', error);
      return false;
    }
  }, [mocks]);

  // Editar um mock existente
  const editMock = useCallback((index: number) => {
    if (index >= 0 && index < mocks.length) {
      setCurrentEditingMockIndex(index);
      return mocks[index];
    }
    return null;
  }, [mocks]);

  // Criar um mock a partir de uma resposta interceptada
  const createMockFromResponse = useCallback((response: InterceptedResponse): MockConfig => {
    // Extrair o URL base da requisição para o mock
    const url = response.url;
    const urlObj = new URL(url);
    const urlPattern = urlObj.hostname + urlObj.pathname;

    // Determinar o método (precisamos adivinhar com base no tipo ou URL)
    let method = 'GET';

    // Criar mock a partir da resposta atual
    const mockData: MockConfig = {
      urlPattern,
      method,
      status: response.status,
      headers: response.headers,
      body: response.body,
      createdAt: Date.now(),
      enabled: true // Por padrão, novos mocks são habilitados
    };

    setCurrentEditingMockIndex(-1); // Indicar que é um novo mock
    return mockData;
  }, []);

  // Cancelar a edição atual
  const cancelEdit = useCallback(() => {
    setCurrentEditingMockIndex(-1);
  }, []);

  // Carregar mocks ao montar o componente
  useEffect(() => {
    loadMocks();
  }, [loadMocks]);

  return {
    mocks,
    loading,
    currentEditingMockIndex,
    loadMocks,
    saveMock,
    removeMock,
    toggleMockEnabled,
    editMock,
    createMockFromResponse,
    cancelEdit
  };
}

import { useState, useEffect, useCallback } from 'react';
import { chromeAPI } from '@/utils/chromeAPI';

export interface UrlPattern {
  url: string;
  method: string;
  headerType?: string;
  headerName?: string;
  headerValue?: string;
  enabled?: boolean;
  isRegex?: boolean;
}

export function useUrlPatterns() {
  const [urlPatterns, setUrlPatterns] = useState<(string | UrlPattern)[]>([]);
  const [loading, setLoading] = useState(true);

  // Carregar padrões de URL do armazenamento
  const loadUrlPatterns = useCallback(async () => {
    setLoading(true);
    try {
      const result = await chromeAPI.storage.local.get(['urlPatterns']);
      const patterns = result.urlPatterns || [];
      setUrlPatterns(patterns);
    } catch (error) {
      console.error('Erro ao carregar padrões de URL:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Adicionar um novo padrão de URL
  const addUrlPattern = useCallback(async (
    urlPattern: string,
    httpMethod: string,
    headerName: string,
    headerValue: string,
    headerType: string,
    isRegex: boolean = false
  ): Promise<boolean> => {
    if (!urlPattern) {
      alert('Por favor, insira um padrão de URL');
      return false;
    }

    // Preparar o objeto de configuração de interceptação
    const interceptConfig: UrlPattern = {
      url: urlPattern,
      method: httpMethod,
      enabled: true, // Por padrão, novas regras são habilitadas
      isRegex: isRegex, // Indica se o padrão de URL é uma expressão regular
    };

    // Adicionar header se estiver preenchido
    if (headerName && headerValue) {
      interceptConfig.headerType = headerType;
      interceptConfig.headerName = headerName;
      interceptConfig.headerValue = headerValue;
    }

    try {
      // Verificar se já existe uma configuração idêntica
      const exists = urlPatterns.some(pattern => {
        if (typeof pattern === 'string') {
          return pattern === urlPattern;
        } else {
          return pattern.url === urlPattern &&
                pattern.method === httpMethod &&
                pattern.headerName === headerName &&
                pattern.headerValue === headerValue &&
                pattern.headerType === headerType;
        }
      });

      if (exists) {
        alert('Esta configuração de interceptação já existe na lista');
        return false;
      }

      // Adicionar nova configuração
      const newPatterns = [...urlPatterns, interceptConfig];

      // Salvar as configurações atualizadas
      await chromeAPI.storage.local.set({ urlPatterns: newPatterns });

      // Atualizar o estado
      setUrlPatterns(newPatterns);

      return true;
    } catch (error) {
      console.error('Erro ao adicionar padrão de URL:', error);
      return false;
    }
  }, [urlPatterns]);

  // Remover um padrão de URL pelo índice
  const removeUrlPattern = useCallback(async (index: number): Promise<void> => {
    try {
      const newPatterns = [...urlPatterns];

      // Remove o padrão pelo índice
      if (index >= 0 && index < newPatterns.length) {
        newPatterns.splice(index, 1);
      }

      // Salvar os padrões atualizados
      await chromeAPI.storage.local.set({ urlPatterns: newPatterns });

      // Atualizar o estado
      setUrlPatterns(newPatterns);
    } catch (error) {
      console.error('Erro ao remover padrão de URL:', error);
    }
  }, [urlPatterns]);

  // Carregar padrões de URL ao montar o componente
  useEffect(() => {
    loadUrlPatterns();
  }, [loadUrlPatterns]);

  // Alternar o estado de habilitado/desabilitado de uma regra
  const toggleRuleEnabled = useCallback(async (index: number): Promise<boolean> => {
    try {
      if (index < 0 || index >= urlPatterns.length) {
        return false;
      }

      const newPatterns = [...urlPatterns];
      const pattern = newPatterns[index];

      // Se for uma string, converter para objeto UrlPattern
      if (typeof pattern === 'string') {
        newPatterns[index] = {
          url: pattern,
          method: 'ANY',
          enabled: true // Habilitar por padrão ao converter
        };
      } else {
        // Alternar o estado enabled
        newPatterns[index] = {
          ...pattern,
          enabled: pattern.enabled === undefined ? false : !pattern.enabled
        };
      }

      // Salvar os padrões atualizados
      await chromeAPI.storage.local.set({ urlPatterns: newPatterns });

      // Atualizar o estado
      setUrlPatterns(newPatterns);

      return true;
    } catch (error) {
      console.error('Erro ao alternar estado da regra:', error);
      return false;
    }
  }, [urlPatterns]);

  // Atualizar uma regra existente
  const updateUrlPattern = useCallback(async (
    index: number,
    updatedPattern: UrlPattern
  ): Promise<boolean> => {
    try {
      if (index < 0 || index >= urlPatterns.length) {
        return false;
      }

      const newPatterns = [...urlPatterns];
      newPatterns[index] = updatedPattern;

      // Salvar os padrões atualizados
      await chromeAPI.storage.local.set({ urlPatterns: newPatterns });

      // Atualizar o estado
      setUrlPatterns(newPatterns);

      return true;
    } catch (error) {
      console.error('Erro ao atualizar regra:', error);
      return false;
    }
  }, [urlPatterns]);

  return {
    urlPatterns,
    loading,
    addUrlPattern,
    removeUrlPattern,
    toggleRuleEnabled,
    updateUrlPattern,
    loadUrlPatterns
  };
}
